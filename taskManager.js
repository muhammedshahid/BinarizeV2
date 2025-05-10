import WorkerManager from './workerManager.js';
class TaskManager extends WorkerManager {
    constructor(workerScript, maxQueuePerWorker = 3) {
        super(workerScript)
        this.taskQueue = []; // Queue to store tasks
        this.activeWorkers = {}; // Map to track tasks assigned to each worker
        this.maxQueuePerWorker = maxQueuePerWorker; // Max tasks per worker
        this._autoCleanUp = 10 // seconds after cleanup starts
        // Start auto-cleanup process
        this._cleanUpInterval = setInterval(() => {
            this._cleanUpWorkers()
        }, this._autoCleanUp);

        // Listen for worker messages
        this.on("taskCompleted", ({ workerId, data }) => {
            //console.log(workerId, data)
            this.markWorkerIdle(workerId);
            this.handleTaskCompletion(workerId, data);
        });

        // Listen for worker status changes
        this.on("workerStatusChange", ({ workerId, status }) => {
            // console.log(`Worker.id: ${workerId}, status.idle: ${status.isIdle}`);
        });

        // Listen for worker termination
        this.on("workerTerminated", ({ workerId }) => {
            delete this.activeWorkers[workerId]
            // console.log(`Worker ${workerId} has been terminated.`);
        });

        // Listen for worker errors
        this.on("workerError", ({ workerId, error }) => {
            console.error(`Error from Worker ${workerId}:`, error.message);
        });

        // Listen for not registered events
        this.on("default", ({ event, data }) => {
            this.emit("updateUI", data.data)
        });

        // TaskManager Events
        this.on("nextTask", (workerId) => {
            if (this.workers[workerId].isIdle && this.activeWorkers[workerId].length > 0) {
                const task = this.activeWorkers[workerId].shift(); // Get next task                
                let data = {
                    type: "task",
                    payload: task
                }
                // console.log(`executing nextTask(${task.taskId}) with wworker ${workerId}: status ${this.workers[workerId].isIdle}`)
                this.postMessageToWorker(workerId, data);
            }
        });
    }

    addTask(payload) {
    // addTask(batchId, imageId, imageData) {
        // Add task to the queue
        // this.taskQueue.push({ batchId, imageId, imageData });
        this.taskQueue.push(payload);
        this.assignTasks();
    }

    assignTasks() {
        // this.emit('updateUI', {
        //     type: 'taskAssigned',
        //     toastMessage: 'Starting processing'
        // })
        // Assign tasks to available workers
        while (this.taskQueue.length > 0) {
            let workerId = Object.keys(this.workers).find((id) => {
                const isActiveQueueUndefined = !this.activeWorkers[id]; // Check if the worker's queue is undefined/null
                const hasRoomInQueue =
                    this.activeWorkers[id] && this.activeWorkers[id].length < this.maxQueuePerWorker;

                return isActiveQueueUndefined || hasRoomInQueue;
            });

            if (!workerId) { // No available workers
                workerId = this.createWorker()
                this.activeWorkers[workerId] = [];
                // console.log("new worker created", workerId)
            }
            const task = this.taskQueue.shift(); // Get the next task
            this.activeWorkers[workerId].push(task); // Track active tasks  
            if (this.workers[workerId].isIdle) this.emit("nextTask", workerId)
        }
        this.emit('updateUI', {
            type: 'taskAssigned',
            toastMessage: 'All images are in queue'
        })
    }

    handleTaskCompletion(workerId, result) {
        const { taskId } = result
        // Remove the completed task from the worker's active list
        this.activeWorkers[workerId] = this.activeWorkers[workerId].filter(
            (id) => id !== taskId
        );

        // Update the UI with the result
        this.emit("updateUI", result)

        // Try to assign more tasks to the worker
        this.emit("nextTask", workerId)
    }

    _cleanUpWorkers() {
        let activeWorkersList = Object.keys(this.activeWorkers)
        if (!activeWorkersList.length || activeWorkersList.length === 1) return
        activeWorkersList.pop() //make sure 1 worker remains
        activeWorkersList.forEach(workerId => {
            let lastExecutionTime = (Date.now() - this.workers[workerId].lastExecutionTime) / 1000
            if (Math.round(lastExecutionTime) > this._autoCleanUp && this.workers[workerId].isIdle) {
                this.terminateWorker(workerId)
            }

        });
    }

    _stopCleanup() {
        clearInterval(this._autoCleanUp);
    }

}
// Export a single instance of TaskManager
const taskManagerInstance = new TaskManager("./webWorker.js");
export default taskManagerInstance;