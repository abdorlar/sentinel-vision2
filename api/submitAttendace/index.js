module.exports = async function (context, req) {
    context.log('Sentinel Vision: Processing Biometric Event.');

    const name = (req.body && req.body.name);
    const eventType = (req.body && req.body.type); // Captures TIME_IN or TIME_OUT
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (name && eventType) {
        // Formatting the response for the Command Center UI
        const actionLabel = eventType === "TIME_IN" ? "AUTHORIZED ENTRY" : "AUTHORIZED EXIT";
        
        context.res = {
            status: 200,
            body: { 
                message: `${actionLabel}: ${name} @ ${timestamp}`,
                status: "SUCCESS",
                correlationId: Math.random().toString(36).substring(2, 10).toUpperCase()
            }
        };
    } else {
        context.res = {
            status: 400,
            body: { message: "SYS_ERR: INVALID_DATA_PACKET" }
        };
    }
};