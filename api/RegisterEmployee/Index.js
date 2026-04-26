module.exports = async function (context, req) {
    const name = req.body && req.body.name;
    const office = req.body && req.body.office;
    const imageBase64 = req.body && req.body.imageBase64; 

    const faceApiKey = process.env.FACE_API_KEY; 
    const faceApiEndpoint = (process.env.FACE_API_ENDPOINT || "").replace(/\/$/, ""); 
    const personGroupId = "sentinel-engineering-team"; 

    if (!name || !imageBase64) {
        context.res = { status: 400, body: { message: "SYS_ERR: Missing Identity or Image Data" } };
        return;
    }

    try {
        // THE FIX: Explicitly request the newest AI Models
        const recognitionModel = "recognition_04";
        const detectionModel = "detection_03";

        // 1. Create the Group (Forcing the modern recognition model)
        const groupRes = await fetch(`${faceApiEndpoint}/face/v1.0/persongroups/${personGroupId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': faceApiKey },
            body: JSON.stringify({ 
                name: "Sentinel Engineering Team",
                recognitionModel: recognitionModel // <--- Override the broken default
            })
        });
        
        if (!groupRes.ok && groupRes.status !== 409) {
            const errData = await groupRes.json();
            throw new Error(`AZURE GROUP ERR: ${errData.error?.message || 'Invalid Request'}`);
        }

        // 2. Create the Person in Azure
        const createPersonRes = await fetch(`${faceApiEndpoint}/face/v1.0/persongroups/${personGroupId}/persons`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': faceApiKey },
            body: JSON.stringify({ name: name, userData: `Office: ${office}` })
        });
        const personData = await createPersonRes.json();
        if (personData.error) throw new Error(`AZURE PERSON ERR: ${personData.error.message}`);

        // 3. Convert Base64 back into binary data
        const imageBuffer = Buffer.from(imageBase64.split(',')[1], 'base64');

        // 4. Upload the raw image stream (Forcing the modern detection model)
        const addFaceRes = await fetch(`${faceApiEndpoint}/face/v1.0/persongroups/${personGroupId}/persons/${personData.personId}/persistedFaces?detectionModel=${detectionModel}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream', 'Ocp-Apim-Subscription-Key': faceApiKey },
            body: imageBuffer
        });
        const faceData = await addFaceRes.json();
        if (faceData.error) throw new Error(`AZURE FACE ERR: ${faceData.error.message}`);

        // 5. Train the AI model
        await fetch(`${faceApiEndpoint}/face/v1.0/persongroups/${personGroupId}/train`, {
            method: 'POST',
            headers: { 'Ocp-Apim-Subscription-Key': faceApiKey }
        });

        context.res = { status: 200, body: { message: `SUCCESS: BIOMETRIC PROFILE CREATED FOR ${name.toUpperCase()}` } };

    } catch (error) {
        context.log.error(error.message);
        context.res = { status: 500, body: { message: `${error.message}` } };
    }
};