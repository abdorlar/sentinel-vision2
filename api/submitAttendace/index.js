module.exports = async function (context, req) {
    const eventType = req.body && req.body.type;
    const imageBase64 = req.body && req.body.imageBase64; 

    const key = process.env.FACE_API_KEY; 
    const endpoint = process.env.FACE_API_ENDPOINT; 
    const groupId = "sentinel-engineering-team"; 

    if (!imageBase64) return context.res = { status: 400, body: { message: "ERR: NO IMAGE DETECTED" } };

    try {
        const imageBuffer = Buffer.from(imageBase64.split(',')[1], 'base64');

        // 1. Detect Face in Image
        const detectRes = await fetch(`${endpoint}/face/v1.0/detect?returnFaceId=true`, {
            method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'Ocp-Apim-Subscription-Key': key }, body: imageBuffer
        });
        const detectedFaces = await detectRes.json();
        
        if (detectedFaces.length === 0) return context.res = { status: 400, body: { message: "ERR: NO FACE FOUND IN FRAME" } };
        const faceId = detectedFaces[0].faceId;

        // 2. Identify the Face
        const identifyRes = await fetch(`${endpoint}/face/v1.0/identify`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': key },
            body: JSON.stringify({ faceIds: [faceId], personGroupId: groupId })
        });
        const identityData = await identifyRes.json();

        if (identityData[0].candidates.length === 0) return context.res = { status: 403, body: { message: "ACCESS DENIED: UNKNOWN PERSON" } };
        const personId = identityData[0].candidates[0].personId;

        // 3. Get Employee Name & Office
        const personRes = await fetch(`${endpoint}/face/v1.0/persongroups/${groupId}/persons/${personId}`, {
            headers: { 'Ocp-Apim-Subscription-Key': key }
        });
        const person = await personRes.json();

        const action = eventType === "TIME_IN" ? "ENTRY" : "EXIT";
        const time = new Date().toLocaleTimeString();

        context.res = {
            status: 200,
            body: { message: `AUTHORIZED ${action}: ${person.name.toUpperCase()} [${person.userData}] @ ${time}` }
        };

    } catch (error) {
        context.log.error(error);
        context.res = { status: 500, body: { message: "SYS_ERR: AI OFFLINE" } };
    }
};