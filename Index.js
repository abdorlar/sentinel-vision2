module.exports = async function (context, req) {
    context.log('Sentinel Vision: Initiating Employee Face Registration.');

    const name = req.body && req.body.name;
    const imageUrl = req.body && req.body.imageUrl; 
    const office = req.body && req.body.office;

    // Securely pull your Azure Face API credentials from environment variables
    const faceApiKey = process.env.FACE_API_KEY; 
    const faceApiEndpoint = process.env.FACE_API_ENDPOINT; 
    const personGroupId = "sentinel-engineering-team"; // You will create this group later

    if (!name || !imageUrl) {
        context.res = { status: 400, body: { message: "SYS_ERR: Missing Name or Image URL" } };
        return;
    }

    try {
        // Step 1: Create the "Person" object in Azure AI
        const createPersonResponse = await fetch(`${faceApiEndpoint}/face/v1.0/persongroups/${personGroupId}/persons`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Ocp-Apim-Subscription-Key': faceApiKey
            },
            body: JSON.stringify({ 
                name: name,
                userData: `Office: ${office || 'General'}` // Saving their office info!
            })
        });
        
        const personData = await createPersonResponse.json();
        const personId = personData.personId;

        // Step 2: Add their face to that Person object
        await fetch(`${faceApiEndpoint}/face/v1.0/persongroups/${personGroupId}/persons/${personId}/persistedFaces`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Ocp-Apim-Subscription-Key': faceApiKey
            },
            body: JSON.stringify({ url: imageUrl })
        });

        // Step 3: Tell the AI to "Train" (study the new face)
        await fetch(`${faceApiEndpoint}/face/v1.0/persongroups/${personGroupId}/train`, {
            method: 'POST',
            headers: { 'Ocp-Apim-Subscription-Key': faceApiKey }
        });

        context.res = {
            status: 200,
            body: { message: `SUCCESS: Biometric profile created for ${name}.` }
        };

    } catch (error) {
        context.log.error(error);
        context.res = { status: 500, body: { message: "SYS_ERR: Face AI Integration Failed." } };
    }
};