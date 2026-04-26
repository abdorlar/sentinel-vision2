module.exports = async function (context, req) {
    const name = req.body && req.body.name;
    const office = req.body && req.body.office;
    const imageBase64 = req.body && req.body.imageBase64; 

    // PRO-FIX: .trim() removes any invisible spaces caused by copy-pasting!
    const rawEndpoint = process.env.FACE_API_ENDPOINT || "";
    const faceApiEndpoint = rawEndpoint.trim().replace(/\/$/, ""); 
    const faceApiKey = (process.env.FACE_API_KEY || "").trim();
    const personGroupId = "sentinel-engineering-team"; 

    if (!name || !imageBase64) return context.res = { status: 400, body: { message: "SYS_ERR: Missing Identity Data" } };

    try {
        const groupUrl = `${faceApiEndpoint}/face/v1.0/persongroups/${personGroupId}`;

        // --- DIAGNOSTIC 1: The Double-URL Bug ---
        if (groupUrl.includes("/face/v1.0/face/v1.0")) {
            return context.res = { status: 500, body: { message: `URL BUG: Your Endpoint in Azure settings includes '/face/v1.0'. Please remove it!` } };
        }

        // 1. Create Group
        const groupRes = await fetch(groupUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': faceApiKey },
            body: JSON.stringify({ name: "Sentinel Engineering Team", recognitionModel: "recognition_04" })
        });
        
        if (!groupRes.ok && groupRes.status !== 409) {
            const errData = await groupRes.json();
            
            // --- DIAGNOSTIC 2: Microsoft Limited Access Block ---
            if (errData.error?.message?.toLowerCase().includes("limited access")) {
                 return context.res = { status: 500, body: { message: `MICROSOFT BLOCK: Azure retired public facial recognition in 2022. Your account is restricted.` } };
            }
            throw new Error(`GROUP FAULT: ${errData.error?.message || 'Invalid Request'}. TRIED URL: ${groupUrl}`);
        }

        // 2. Create Person
        const createPersonRes = await fetch(`${faceApiEndpoint}/face/v1.0/persongroups/${personGroupId}/persons`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': faceApiKey },
            body: JSON.stringify({ name: name, userData: `Office: ${office}` })
        });
        const personData = await createPersonRes.json();
        if (personData.error) throw new Error(`PERSON FAULT: ${personData.error.message}`);

        // 3. Add Face
        const imageBuffer = Buffer.from(imageBase64.split(',')[1], 'base64');
        const addFaceRes = await fetch(`${faceApiEndpoint}/face/v1.0/persongroups/${personGroupId}/persons/${personData.personId}/persistedFaces?detectionModel=detection_03`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream', 'Ocp-Apim-Subscription-Key': faceApiKey },
            body: imageBuffer
        });
        const faceData = await addFaceRes.json();
        if (faceData.error) throw new Error(`FACE FAULT: ${faceData.error.message}`);

        // 4. Train AI
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