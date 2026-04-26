module.exports = async function (context, req) {
    const name = req.body && req.body.name;
    const office = req.body && req.body.office;
    const imageBase64 = req.body && req.body.imageBase64; 

    const faceApiKey = process.env.FACE_API_KEY; 
    // PRO-FIX: Automatically remove any accidental trailing slashes from the endpoint!
    const faceApiEndpoint = (process.env.FACE_API_ENDPOINT || "").replace(/\/$/, ""); 
    const personGroupId = "sentinel-engineering-team"; 

    if (!name || !imageBase64) {
        context.res = { status: 400, body: { message: "SYS_ERR: Missing Identity or Image Data" } };
        return;
    }

    try {
        // 1. Create the Group (with X-Ray error checking)
        const groupRes = await fetch(`${faceApiEndpoint}/face/v1.0/persongroups/${personGroupId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': faceApiKey },
            body: JSON.stringify({ name: "Sentinel Engineering Team" })
        });
        
        // Status 409 just means the group already exists, which is perfectly fine.
        if (!groupRes.ok && groupRes.status !== 409) {
            const errData = await groupRes.json();
            throw new Error(`AZURE GROUP ERR: ${errData.error?.message || 'Unknown Group Error'}`);
        }

        // 2. Create the Person in Azure
        const createPersonRes = await fetch(`${faceApiEndpoint}/face/v1.0/persongroups/${personGroupId}/persons`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': faceApiKey },
            body: JSON.stringify({ name: name, userData: `Office: ${office}` })
        });
        const personData = await createPersonRes.json();
        
        // If Azure sends an error object, throw it so we can read it!
        if (personData.error) {
            throw new Error(`AZURE PERSON ERR: ${personData.error.message}`);
        }
        if (!personData.personId) throw new Error("Failed to get Person ID from Azure.");

        // 3. Convert Base64 back into binary data
        const imageBuffer = Buffer.from(imageBase64.split(',')[1], 'base64');

        // 4. Upload the raw image stream
        const addFaceRes = await fetch(`${faceApiEndpoint}/face/v1.0/persongroups/${personGroupId}/persons/${personData.personId}/persistedFaces`, {
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
        // We now send the EXACT Microsoft error to the frontend screen
        context.res = { status: 500, body: { message: `${error.message}` } };
    }
};