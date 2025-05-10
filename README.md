# BinarizeV2
- Version 2 of previous Binarize App with enhanced UI

# **Image Processing Web App Using Web Workers**

This project processes user-uploaded images efficiently using **Web Workers** to offload computational tasks. The app ensures a smooth UI experience while dynamically managing workers and tasks for optimal performance.

---

## **Live**
- https://muhammedshahid.github.io/BinarizeV2/

---

## **Key Features**

- **Image Upload and Processing**: Users can upload multiple images for processing (e.g., binary conversion).  
- **Web Workers**: Heavy image computations are offloaded to Web Workers, keeping the UI responsive.  
- **Task Management**: Tasks are dynamically distributed among Web Workers with controlled limits.  
- **Modular Architecture**: Clean separation of UI, task handling, and Web Worker lifecycle.  

---

## **How It Works**

1. **User Uploads Images**:  
   Users upload one or more images for processing. The UI displays the uploaded images in a gallery.

2. **Task Distribution**:  
   The **TaskManager** assigns tasks to Web Workers, ensuring efficient resource utilization by limiting tasks per worker.

3. **Web Worker Execution**:  
   The **WebWorkerManager** creates and manages workers. Workers process the image data (e.g., converting to binary) and return the results.

4. **Results Display**:  
   Processed images are updated back on ui seamlessly.

---

## **Project Structure**

```plaintext
/project-root
│
├── /src
│   ├── index.html            # Main UI layout
│   ├── main.js               # Handles UI and user interactions
│   ├── taskManager.js        # Task distribution logic
│   ├── webWorkerManager.js   # Web Worker lifecycle management
│   ├── workerScript.js       # Worker logic for image processing
│   └── styles.css            # Styling for the application
│
├── /assets                   # Static assets like sample images
│
├── README.md                 # Project documentation
└── package.json              # Dependencies (if any)
```
---

## **Technologies Used**

- **HTML5**: Structure of the application
- **CSS3**: Clean and responsive UI
- **JavaScript (ES6)**: Core logic, Task Manager, and Web Workers
- **Web Workers**: Multi-threading for heavy computations

---
