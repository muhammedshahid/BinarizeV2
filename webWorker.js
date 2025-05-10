importScripts('./singleChannelBinarize.js')
// importScripts('./rgbChannelBinarize.js')

// class EventEmitter { // used for communication inside worker    
//     constructor() {
//         this.events = {};
//     }

//     on(event, listener) {
//         if (!this.events[event]) this.events[event] = [];
//         this.events[event].push(listener);
//     }

//     emit(event, data) {
//         if (this.events[event]) {
//             this.events[event].forEach((listener) => listener(data));
//         }
//     }
// }

self.onmessage = async function (e) {
    let data = {};
    switch (e.data.type) {
        case "task":
            const { imageData, batchId, imageId } = e.data.payload;
            try {
                // const result = await rgbChannelBinarize(imageData, (progress) => {
                //     self.postMessage({
                //         type: "progress",
                //         imageId: imageId,
                //         batchId: batchId,
                //         progress,
                //     });
                // });
                const result = await singleChannelBinarize(imageData, (progress) => {
                    self.postMessage({
                        type: "progress",
                        imageId: imageId,
                        batchId: batchId,
                        progress,
                    });
                });
                self.postMessage({
                    type: "taskCompleted",
                    imageId: imageId,
                    batchId: batchId,
                    processedImage: result
                });
            } catch (error) {
                self.postMessage({
                    type: "error",
                    imageId: imageId,
                    batchId: batchId,
                    payload: { error: error.message },
                });
            }
            break;

        default:
            console.warn("[Web Worker]: Unknown message type:", type);
    }
};
