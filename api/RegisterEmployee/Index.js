module.exports = async function (context, req) {
    const name = req.body && req.body.name;
    const office = req.body && req.body.office;
    const imageBase64 = req.body && req.body.imageBase64; 

    const faceApiKey = process.env.FACE_API_KEY; 
    const faceApiEndpoint = process.env.FACE_API_ENDPOINT; 
    const personGroupId = "sentinel-engineering-team"; 

    if (!name || !imageBase64) {
        context.res = { status: 400, body: { message: "SYS_ERR: Missing Identity or Image Data" } };
        return;
    }

    try {
        // ---> THE FIX: Tell Azure to create the group if it doesn't exist yet <---
        await fetch(`${faceApiEndpoint}/face/v1.0/persongroups/${personGroupId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': faceApiKey },
            body: JSON.stringify({ name: "Sentinel Engineering Team" })
        });

        // 1. Create the Person in Azure
        const createPersonRes = await fetch(`${faceApiEndpoint}/face/v1.0/persongroups/${personGroupId}/persons`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': faceApiKey },
            body: JSON.stringify({ name: name, userData: `Office: ${office}` })
        });
        const personData = await createPersonRes.json();
        
        if (!personData.personId) throw new Error("Failed to create Person object.");

        // 2. Convert Base64 back into binary data
        const imageBuffer = Buffer.from(imageBase64.split(',')[1], 'base64');

        // 3. Upload the raw image stream to Azure Face API
        const addFaceRes = await fetch(`${faceApiEndpoint}/face/v1.0/persongroups/${personGroupId}/persons/${personData.personId}/persistedFaces`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream', 'Ocp-Apim-Subscription-Key': faceApiKey },
            body: imageBuffer
        });
        
        const faceData = await addFaceRes.json();
        if (faceData.error) throw new Error("Azure could not detect a clear face in the image.");

        // 4. Train the AI model on the new face
        await fetch(`${faceApiEndpoint}/face/v1.0/persongroups/${personGroupId}/train`, {
            method: 'POST',
            headers: { 'Ocp-Apim-Subscription-Key': faceApiKey }
        });

        context.res = { status: 200, body: { message: `SUCCESS: BIOMETRIC PROFILE CREATED FOR ${name.toUpperCase()}` } };

    } catch (error) {
        context.log.error(error.message);
        context.res = { status: 500, body: { message: `SYS_ERR: FACE AI FAILED. DETAIL: ${error.message}` } };
    }
};