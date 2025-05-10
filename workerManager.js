class EventEmitter {
    constructor() {
        this.events = {};
        this.defaultListener = null; // Add a default listener
    }

    on(event, listener) {
        if (event === "default") {
            this.defaultListener = listener;
        } else {
            if (!this.events[event]) this.events[event] = [];
            this.events[event].push(listener);
        }
    }

    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach((listener) => listener(data));
        } else if (this.defaultListener) {
            // Call the default listener for unknown events
            this.defaultListener({ event, data });
        } else {
            console.warn(`Unhandled event emitter: ${event}`);
        }
    }
}

class WorkerManager extends EventEmitter {
    constructor(workerScript) {
        super(); // Initialize EventEmitter Communication channel
        this.workerScript = workerScript;
        this.workers = {}; // Map to hold workers
    }

    createWorker() {
        const id = `worker-${Date.now()}`;
        if (!this.workers[id]) {
            const worker = new Worker(this.workerScript);
            this.workers[id] = worker;
            this.workers[id].isIdle = true;
            this.workers[id].lastExecutionTime = Date.now()
            // Listen for messages from the worker
            worker.onmessage = (e) => {
                this.emit(e.data.type, { workerId: id, data: e.data });
            };
            // Handle errors
            worker.onerror = (error) => {
                this.emit("workerError", { id, error });
            };
        }
        return id;
    }

    postMessageToWorker(workerId, task) {
        const worker = this.workers[workerId];
        worker.isIdle = false; // Mark as busy
        worker.lastExecutionTime = Date.now();
        worker.postMessage(task);
    }

    markWorkerIdle(workerId) {
        if (this.workers[workerId]) {
            this.workers[workerId].isIdle = true;
            this.emit("workerStatusChange", { workerId, status:{ isIdle: true }});
        }
    }

    terminateWorker(workerId) {
        if (this.workers[workerId]) {
            this.workers[workerId].terminate();
            delete this.workers[workerId];
            this.emit("workerTerminated", { workerId });
        }
    }
}
// Export a single instance of WorkerManager
// const workerManagerInstance = new WorkerManager("./webWorker.js");
// export default workerManagerInstance;
export default WorkerManager