// import JSZip from 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.esm.min.js';
import taskManager from "./taskManager.js";

// const zip = new JSZip();
const zip = new window.JSZip();
console.log(zip)

document.addEventListener('DOMContentLoaded', () => {
    const elements = document.querySelectorAll('.operation');
    const deleteConfirmationBox = document.querySelector('#deleteConfirmation');
    elements.forEach(element => {
        element.addEventListener('pointerdown', () => {
            operation(element);
        });
    });
    deleteConfirmationBox.addEventListener('pointerdown', (e) => {
        if (e.target.classList.contains('cancel-btn')) {
            closeDeleteConfirmation();

        } else if (e.target.classList.contains('confirm-btn')) {
            const elementId = e.currentTarget.getAttribute('data-id');
            closeDeleteConfirmation();
            deleteItems(elementId);
        }
    });
})

class ImageStore {
    constructor() {
        if (ImageStore.instance) return ImageStore.instance
        this.imageMap = new Map()
        this.batches = {}
        ImageStore.instance = this
    }

    makeBatch(files) {
        const batchDiv = addBatchPreview()
        const promises = files.map(file =>
            this.addImage(file, batchDiv.id).catch(error => {
                console.error(`addImage: ${file.name} at ${batchDiv.id}\n`, error)
                return null
            })
        )
        Promise.all(promises)
            .then(results => {
                // Filter out nulls (failed promises) from the results
                const storedImageIds = results.filter(result => result !== null)
                if (!storedImageIds.length) {
                    batchDiv.remove()
                    return
                }
                this.batches[batchDiv.id] = storedImageIds
                this.addImagePreviews(storedImageIds)
            })
            .catch(error => {
                console.error(`Unexpected error at ${batchDiv.id}:`, error)
            })
    }

    addImage(file, batchId) {
        return new Promise((resolve, reject) => {
            if (!file.type.startsWith('image/')) {
                return reject(
                    new Error(`Invalid file type: ${file.type} at ${batchId}`)
                )
            }
            this.#readFile(file)
                .then(fileDataURL => this.#preloadImage(fileDataURL))
                .then(preloadedImg => {
                    const imageMetaData = this.#generateMetadata(
                        file,
                        batchId,
                        preloadedImg
                    )
                    this.imageMap.set(imageMetaData.imageId, imageMetaData)
                    // this.previewImage(imageMetaData.imageId)
                    return imageMetaData.imageId
                })
                .then(resolve)
                .catch(reject)
        })
    }

    addImagePreviews(imageIds) {
        if (!imageIds.length) return
        const imageDetails = this.getImages({ imageIds: imageIds })
        if (!imageDetails.length) return
        imageDetails.map(addImagePreview)
    }

    getImages({ batchIds = [], imageIds = [] } = {}) {
        if (batchIds.length > 0) {
            return batchIds.map(
                id =>
                    this.batches[id]?.map(id => this.imageMap.get(id)) || [] || []
            )
        }
        if (imageIds.length > 0) {
            return imageIds
                .map(id => this.imageMap.get(id))
                .filter(img => img !== undefined)
        }
        return Array.from(this.imageMap.values())
    }

    getAllBatch() { }

    removeBatch(batchIds) {
        if (!Array.isArray(batchIds))
            batchIds = [batchIds].filter(e => e !== undefined)
        if (!batchIds.length) return
        console.log(batchIds)
    }

    removeImage(imageIds) {
        if (!Array.isArray(imageIds))
            imageIds = [imageIds].filter(e => e !== undefined)
        if (!imageIds.length) return
        let imageDetails = this.getImages({ imageIds: imageIds })
        if (!imageDetails.length) return
        let batchestoWatch = {}
        const deletedItems = { batchIds: [], imageIds: {} }
        imageDetails.map(image => {
            let { batchId, imageId } = image;
            if (!this.imageMap.delete(imageId)) return;
            let index = this.batches[batchId].indexOf(imageId);
            if (index !== -1) this.batches[batchId].splice(index, 1);
            (batchestoWatch[batchId] = batchestoWatch[batchId] || []).push(imageId);
        });
        Object.keys(batchestoWatch).map(id => {
            if (!this.batches[id].length) {
                delete this.batches[id]
                deletedItems.batchIds.push(id)
            } else {
                deletedItems.imageIds[id] = batchestoWatch[id]
            }
        })
        return deletedItems
    }

    updateImageStore(imageId, newProperties) {
        if (!this.imageMap.has(imageId)) return
        const value = this.imageMap.get(imageId)
        Object.assign(value, newProperties)
        this.imageMap.set(imageId, value)
    }

    cleanUpBatch(batchIdArray) { }

    cleanUpImage(imageIdArray) { }

    #readFile(file) {
        return new Promise((resolve, reject) => {
            if (!file.type.startsWith('image/')) reject(new Error(`${file.name} is not a Image`))
            const reader = new FileReader()
            reader.onload = e => resolve(e.currentTarget.result)
            reader.onerror = e =>
                reject(new Error('Cannot read file', { cause: e }))
            reader.readAsDataURL(file)
        })
    }

    #preloadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image()
            img.onload = () => resolve(img)
            img.onerror = reject
            img.src = src
        })
    }

    #createThumbnail(preloadedImg, size) {
        const dimensions = {
            width: preloadedImg.naturalWidth,
            height: preloadedImg.naturalHeight
        }
        const aspectRatio = dimensions.width / dimensions.height
        let thumbnailWidth = dimensions.width
        let thumbnailHeight = dimensions.height
        const maxWidth = dimensions.width * size
        const maxHeight = dimensions.height * size
        // Calculate dimensions for the thumbnail while preserving the aspect ratio
        if (dimensions.width > maxWidth || dimensions.height > maxHeight) {
            if (aspectRatio > 1) {
                // Landscape image
                thumbnailWidth = maxWidth
                thumbnailHeight = Math.round(maxWidth / aspectRatio)
            } else {
                // Portrait or square image
                thumbnailHeight = maxHeight
                thumbnailWidth = Math.round(maxHeight * aspectRatio)
            }
        }
        const canvas = document.createElement('canvas')
        canvas.width = thumbnailWidth
        canvas.height = thumbnailHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(preloadedImg, 0, 0, canvas.width, canvas.height)
        const thumbnail = canvas.toDataURL()
        return {
            dimensions,
            thumbnailDimensions: {
                width: thumbnailWidth,
                height: thumbnailHeight
            },
            thumbnail,
            aspectRatio
        }
    }

    #generateMetadata(file, batchId, preloadedImg) {
        function formatDateTime(timestamp) {
            const options = {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }

            return new Intl.DateTimeFormat('en-US', options).format(
                new Date(timestamp)
            )
        }

        function formatSize(size) {
            const units = ['B', 'KB', 'MB', 'GB', 'TB']
            let index = 0
            while (size >= 1024 && index < units.length - 1) {
                size /= 1024
                index++
            }
            return `${size.toFixed(2)} ${units[index]}`
        }

        const thumbnailData = this.#createThumbnail(preloadedImg, 0.5)

        return Object.assign(
            {
                imageId: `_image-${Date.now()}`,
                batchId: batchId,
                fileName: file.name,
                fileType: file.type,
                fileSize: formatSize(file.size),
                dimensions: { width: 0, height: 0 },
                thumbnailDimensions: { width: 0, height: 0 },
                aspectRatio: null,
                thumbnail: null,
                previewLoaded: false,
                source: file,
                processedSource: null,
                addedAt: formatDateTime(Date.now()),
                lastModified: formatDateTime(file.lastModified),
                isProcessed: false,
                isDeleted: false,
                userPreferences: {
                    preferredBrightness: 1,
                    preferredContrast: 1
                }
            },
            thumbnailData
        )
    }
}

function lazyLoadImage(container, imageSrc) {
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const isProcessed = container.getAttribute('data-isProcessed') === "true";
                if(isProcessed){
                    centralizedImageStore.updateImageStore(container.id, { previewLoaded: false, thumbnail: null })
                }else {
                    // thumbnail can be created here
                    // no need to make it early
                    const img = container.querySelector('img')
                    img.onload = () => {
                        centralizedImageStore.updateImageStore(container.id, { previewLoaded: true, thumbnail: null })
                    }
                    img.src = imageSrc
                }
                observer.unobserve(entry.target) // Stop observing once loaded
            }
        })
    })
    observer.observe(container)
}

function toastNotification(message) {
    function extractNumericValue(cssValue) {
        return parseFloat(cssValue.replace(/[^\d.]/g, '')) // Remove non-numeric characters
    }
    const toastContainer = document.querySelector('.toast__container')
    const root = document.documentElement
    const fadeInDuration = extractNumericValue(
        getComputedStyle(root).getPropertyValue('--fade-in-duration')
    ) // 0.5
    const fadeOutDuration = extractNumericValue(
        getComputedStyle(root).getPropertyValue('--fade-out-duration')
    ) // 4
    const slideOutDuration = extractNumericValue(
        getComputedStyle(root).getPropertyValue('--slide-out-duration')
    ) // 0.5
    const displayOutTime =
        (fadeInDuration + fadeOutDuration + slideOutDuration) * 1000
    const toastDiv = document.createElement('div')
    toastDiv.className = 'toast'
    const template = `
    <p>${message.trim()}</p>
    <button class="close-toast">❌</button>
    `
    toastDiv.innerHTML = template
    // toastDiv.querySelector('.close-toast').addEventListener('pointerdown', e => {
    //   e.target.parentElement.style.display = 'none'
    // })
    toastDiv.addEventListener('pointerdown', e => {
        e.currentTarget.style.display = 'none'
    })
    toastContainer.appendChild(toastDiv)

    setTimeout(() => {
        toastContainer.firstElementChild.remove()
        // toastDiv.remove()
    }, displayOutTime + 10)
}

function openModal(rootElement) {
    const modal = document.querySelector('#modal')
    const src = rootElement.querySelector('img').src
    modal.innerHTML = `<div class="modal__content">
    <button class="close-modal">❌</button>
    <img class="modal-image" src="${src}" alt="Modal Image" />
    </div>`
    const handleModalClick = e => {
        e.preventDefault()
        let classes = e.target.classList.value
        // let currentRoot = e.currentTarget
        switch (classes) {
            case 'close-modal':
                e.currentTarget.classList.remove('open')
                // e.currentTarget.classList.add('hidden')
                e.currentTarget.innerHTML = ''
                e.currentTarget.removeEventListener(
                    'pointerdown',
                    handleModalClick
                )
                break
            case 'prev':
                let prevElement = rootElement.previousElementSibling
                if (!prevElement) return
                e.currentTarget.querySelector('img').src =
                    prevElement.querySelector('img').src
                rootElement = prevElement
                break
            case 'next':
                let nextElement = rootElement.nextElementSibling
                if (!nextElement) return
                e.currentTarget.querySelector('img').src =
                    nextElement.querySelector('img').src
                rootElement = nextElement
                break

            default:
                const modalWidth = e.currentTarget.offsetWidth
                const clickX = e.clientX

                if (clickX < modalWidth / 2) {
                    // Left side clicked
                    let prevElement = rootElement.previousElementSibling
                    if (!prevElement) return
                    // e.currentTarget.querySelector('img').classList.add('fade-out') // Trigger fade-out animation
                    e.currentTarget.querySelector('img').src =
                        prevElement.querySelector('img').src
                    e.currentTarget
                        .querySelector('img')
                        .classList.remove('fade-out')
                    rootElement = prevElement
                } else {
                    // Right side clicked
                    let nextElement = rootElement.nextElementSibling
                    if (!nextElement) return
                    // e.currentTarget.querySelector('img').classList.add('fade-out') // Trigger fade-out animation
                    e.currentTarget.querySelector('img').src =
                        nextElement.querySelector('img').src
                    e.currentTarget
                        .querySelector('img')
                        .classList.remove('fade-out')
                    rootElement = nextElement
                }
        }
    }
    // Using Event Delegation
    modal.addEventListener('pointerdown', handleModalClick)
    // modal.classList.remove('hidden')
    modal.classList.add('open')
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) reject(new Error(`${file.name} is not a Image`))
        const reader = new FileReader()
        reader.onload = e => resolve(e.currentTarget.result)
        reader.onerror = e =>
            reject(new Error('Cannot read file', { cause: e }))
        reader.readAsDataURL(file)
    })
}

function preloadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = src
    })
}

function drawImgOnCanvas(img, dimensions = {}) {
    const width = dimensions.width > 0 ? dimensions.width : img.naturalWidth
    const height = dimensions.height > 0 ? dimensions.height : img.naturalHeight
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
}

function convertCanvasToBlob(canvas, type, quality = 1) {
    return new Promise((resolve) => {
        canvas.toBlob(resolve, type, quality);
    });
}

function imageDataToDataUrl(imageData) {
    const canvas = document.createElement('canvas')
    canvas.width = imageData.width
    canvas.height = imageData.height
    const ctx = canvas.getContext('2d')
    ctx.putImageData(imageData, 0, 0)
    return canvas.toDataURL('image/png')
}

function imageDataToFile(imageId, imageData) {
    return new Promise((resolve, reject) => {
        const imageDetails = centralizedImageStore.getImages({ imageIds: [imageId] })
        if (!imageDetails.length || imageDetails[0].imageId !== imageId) reject(new Error(`imageDataToFile:: No image found with id ${imageId}`));
        const { fileName } = imageDetails[0]
        const imageType = 'webp'
        const canvas = document.createElement('canvas')
        canvas.width = imageData.width
        canvas.height = imageData.height
        const ctx = canvas.getContext('2d')
        ctx.putImageData(imageData, 0, 0)
        canvas.toBlob(blob => {
            if (blob) {
                let newFileName = fileName.replace(/(.*)(\.[^.]+)$/, `$1-${'binarize'}.${imageType}`);
                const file = new File([blob], `${newFileName}`, { type: `image/${imageType}` })
                resolve(file)
            } else {
                reject(new Error('imageDataToFile:: Failed to convert canvas to Blob.'))
            }
        }, `image/${imageType}`)
    })
}

async function fileToImageUrl(imageFile, dimensions = { width: 0, height: 0 }) {
    const imgSrc = await readFile(imageFile);
    const image = await preloadImage(imgSrc);
    const canvas = drawImgOnCanvas(image, dimensions);
    return canvas.toDataURL(imageFile.type);
}

async function getImagedata(imageFile) {
    const imgSrc = await readFile(imageFile);
    const image = await preloadImage(imgSrc);
    const canvas = drawImgOnCanvas(image);
    const ctx = canvas.getContext('2d');
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
}



function processImages(parentElement) {
    const checkedImages = [...parentElement.querySelectorAll('.grid article:has(input[type="checkbox"]:checked)')]
    resetCheck(checkedImages)
    const imageIds = checkedImages.map(imageNode => imageNode.id)
    if (!imageIds || !imageIds.length) return
    const imageDetails = centralizedImageStore.getImages({ 'imageIds': imageIds })
    imageDetails.forEach(imageDetail => {
        const { imageId, batchId } = imageDetail;
        getImagedata(imageDetail.source).then(imageData => {
            // send imageData to worker
            taskManager.addTask({ batchId: batchId, imageId: imageId, imageData: imageData });
        });
    });
}

function removeWithEffect(element) {
    element.classList.add('disappear');
    element.addEventListener('transitionend', () => {
        element.remove();
    });
    element.addEventListener('animationend', () => {
        element.remove();
    });
}

function isDocument(element) {
    return element === document;
}

function openDeleteConfirmation(element){
    const delBox = document.querySelector('#deleteConfirmation');
    const isDoc = isDocument(element)
    const query = '.grid input[type="checkbox"]:checked';
    const selector = !isDoc ? `#${element.id} ${query}` : `${query}`;
    const count = document.querySelectorAll(selector).length;
    delBox.setAttribute('data-id', !isDoc?element.id:'');
    delBox.querySelector('.count').innerText = count;
    delBox.classList.replace('hidden', 'show')
}

function closeDeleteConfirmation(){
    const delBox = document.querySelector('#deleteConfirmation');
    delBox.classList.replace('show', 'hidden');
    delBox.removeAttribute('data-id');
    delBox.querySelector('.count').innerText = '';
}

function deleteItems(parentElementId) {
    const isDoc = parentElementId? false: true;
    const query = '.grid article:has(input[type="checkbox"]:checked)';
    const selector = !isDoc ? `#${parentElementId} ${query}` : `${query}`;
    const checkedImages = [...document.querySelectorAll(selector)];
    resetCheck(checkedImages);
    const checkedImageIds = checkedImages.map(image => image.id);

    if (!checkedImageIds || !checkedImageIds.length) return
    const deletedItems = centralizedImageStore.removeImage(checkedImageIds)
    const { batchIds, imageIds } = deletedItems
    if (batchIds.length) {
        batchIds.map(batchId => {
            removeWithEffect(document.querySelector(`#${batchId}`))
        })
    }
    for (let key in imageIds) {
        imageIds[key].forEach(imageId => {
            removeWithEffect(document.querySelector(`#${imageId}`))
        })
    }
}

function showProgressBox(title) {
    // const infoBoxContainer = document.getElementById('infoBoxContainer');
    // infoBoxContainer.classList.remove('hidden');
    const container = document.getElementById('infoBoxContainer');
    const infoBox = document.createElement('div');
    infoBox.classList.add('info-box');
    infoBox.id = "_randomId";
    infoBox.innerHTML = `
      <div class="info-header">
        <span class="info-title">${title}</span>
        <button class="info-close" aria-label="Close">&times;</button>
      </div>
      <div class="info-progress">
        <div class="progress-bar">
          <div class="progress" style="width: 0%;"></div>
        </div>
        <span class="progress-status">0%</span>
      </div>
    `;
    container.appendChild(infoBox);
    infoBox.querySelector('.info-close').addEventListener('click', () => {
      infoBox.remove();
    });
    return infoBox.id;
}

function downloadFiles(parentElement) {
    function tracker(message, progress) {
        const progressBox = `#${this}`;
        const title = document.querySelector(`${progressBox} .info-title`);
        const progressBar = document.querySelector(`${progressBox} .progress`);
        const progressStatus = document.querySelector(`${progressBox} .progress-status`);
        title.innerText = message;
        progressBar.style.width = `${progress}%`;
        progressStatus.textContent = `${Math.round(progress)}%`;
        if(progress == 100 || progress > 100) {
            setTimeout(() => document.querySelector(progressBox).remove(), 1500);
            return;
        }
    }
    const query = '.grid article:has(input[type="checkbox"]:checked)';
    const checkedImages = [...parentElement.querySelectorAll(query)];
    const checkedImageIds = checkedImages.map(image => image.id);
    if (!checkedImageIds || !checkedImageIds.length) return
    resetCheck(checkedImages);
    const totalSteps = checkedImageIds.length * 3; // 3 steps per image (fetch, process, zip)
    let completedSteps = 0;
    const updateProgress = function(message) {
        completedSteps++;
        const progress = (completedSteps / totalSteps) * 100;
        tracker.call(this , message, progress);
    };
    const imageDetails = centralizedImageStore.getImages({imageIds:checkedImageIds});
    const progressBoxId = showProgressBox('Intialize');
    imageDetails.map(async imageDetail => {
        const { processedSource } = imageDetail;
        const fileName = processedSource.name.match(/^(.*)\.([^.]*)$/);

        // Step 1: Read file
        updateProgress.call(progressBoxId, `Fetching ${fileName[0]}`);
        const imgSrc = await readFile(processedSource);

        // Step 2: Process image
        updateProgress.call(progressBoxId, `Processing ${fileName[0]}`);
        const image = await preloadImage(imgSrc);
        const canvas = drawImgOnCanvas(image);
        const blob = await convertCanvasToBlob(canvas, processedSource.type);

        // Step 3: Add to ZIP
        updateProgress.call(progressBoxId, `Zipping ${fileName[0]}`);
        zip.file(`${fileName[1]}.${fileName[2]}`, blob);
    });
}

async function downloadZip(){
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(zipBlob);
    a.download = 'images.zip';
    a.click();
}
window.downloadZip = downloadZip;

function operation(element) {
    const opcode = element.getAttribute('role').trim().toLowerCase();
    let e = element.closest('section');
    const parent = e ? e : document;
    switch (opcode) {
        case 'process':
            processImages(parent);
            break
        case 'download':
            downloadFiles(parent);
            break
        case 'save':
            console.log('this is save');
            break
        case 'delete':
            openDeleteConfirmation(parent);
            break
        default:
            console.log('this is opcode default');
    }
}

function populateCenter(checkbox = true) {
    const sectionId = `#${this}`
    const query = checkbox
        ? '.grid input[type=checkbox]:checked'
        : '.grid input[type=checkbox]'
    const center = document.querySelector(`${sectionId} .group.center`)
    const inlineOperation = document.querySelector(`${sectionId} .inline-batch-operation>ul`)
    const blockOperation = document.querySelector('.batch__operations')
    const allCheckedItems = document.querySelectorAll('.grid input[type=checkbox]:checked')
    const count = document.querySelectorAll(`${sectionId} ${query}`).length

    let innerhtml = `<span>${count} image(s) selected</span>`
    if (!checkbox) {
        innerhtml = `<span>${count} image(s)</span>`
    }
    if (allCheckedItems.length) {
        inlineOperation.classList.add('show')
        blockOperation.classList.add('show')
    } else {
        inlineOperation.classList.remove('show')
        blockOperation.classList.remove('show')
    }
    if (count) {
        center.innerHTML = innerhtml
        return
    }
    center.innerHTML = ''
    return
}

function addBatchPreview() {
    const section = document.createElement('section')
    section.id = `_batch-${Date.now()}`
    const template = `<div class="section__operation">
      <div class="group">
        <label class="custom-checkbox">
          <input type="checkbox" />
          <span class="checkmark batch-checkmark"></span>
        </label>
        <span>Batch</span>
      </div>
      <div class="group center">
        <span></span>
      </div>
      <div class="group right">
        <nav class="inline-batch-operation">
            <ul>
              <li class="operation" role="Process">
                <span class="icon operation" role="Process">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="1rem" height="1rem" class="operation">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </span>
              </li>
              <li class="operation" role="Save">
                <span class="icon operation" role="Save">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="1rem" height="1rem" class="operation">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15M9 12l3 3m0 0 3-3m-3 3V2.25" />
                  </svg>
                </span>
              </li>
              <li class="operation" role="Download">
                <span class="icon operation" role="Download">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="1rem" height="1rem" class="operation">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                  </svg>
                </span>
              </li>
              <li class="operation" role="Delete">
                <span class="icon operation" role="Delete">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="1rem" height="1rem" class="operation">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </span>
              </li>
            </ul>
          </nav>
        <span class="collapse-icon" aria-expanded="true"></span>
      </div>
    </div>
    <div class="grid"></div>`
    section.innerHTML = template
    section.addEventListener('pointerdown', e => {
        if (e.target.classList.contains('collapse-icon')) {
            const icon = e.target
            const grid = icon.closest('section').querySelector('.grid')
            const isExpanded = icon.getAttribute('aria-expanded') === 'true'
            icon.setAttribute('aria-expanded', !isExpanded)
            grid.classList.toggle('collapsed')
            populateCenter.call(section.id, !isExpanded)
        } else if (e.target.classList.contains('batch-checkmark')) {
            const checked = !e.target.previousElementSibling.checked
            const parent = e.currentTarget
            const isCollapsed =
                parent
                    .querySelector('.collapse-icon')
                    .getAttribute('aria-expanded') === 'true'
            parent
                .querySelectorAll('.grid input[type=checkbox]')
                .forEach(e => (e.checked = checked))
            populateCenter.call(section.id, true && isCollapsed)
        } else if (e.target.classList.contains('operation')) {
            if (!e.target.closest('ul.show')) return
            let element = e.target.getAttribute('role') ? e.target : e.target.closest('li')
            // let opcode = e.target.getAttribute('role').trim()
            // if(!opcode) {
            //   opcode = e.target.closest('li').getAttribute('role').trim()
            // }
            operation(element)
        }
    })
    section.addEventListener('change', e => {
        if (e.target.type !== 'checkbox') return
        if (!e.target.closest('.cell')) return
        const parent = e.currentTarget
        const batchCheckBox = parent.querySelector('.batch-checkmark')
        const allImages = parent.querySelectorAll(
            '.grid input[type=checkbox]'
        ).length
        const checkedImages = parent.querySelectorAll(
            '.grid input[type=checkbox]:checked'
        ).length
        const batchCheckBoxState = !(allImages - checkedImages) ? true : false
        batchCheckBox.previousElementSibling.checked = batchCheckBoxState
        populateCenter.call(section.id, true)
    })
    previewList.appendChild(section)
    return section
}

function addImagePreview(imageDetails) {
    const {
        fileName,
        fileSize,
        lastModified,
        thumbnail,
        batchId,
        imageId
    } = imageDetails
    let cellDiv = document.createElement('article')
    cellDiv.className = 'cell'
    cellDiv.id = imageId
    cellDiv.innerHTML = `<div class="imagePreview">
        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAAtJREFUGFdjYAACAAAFAAGq1chRAAAAAElFTkSuQmCC" alt="processing ${fileName}">
        <span class="loading default-skeleton"></span>
        <label class="custom-checkbox">
          <input type="checkbox" />
          <span class="checkmark"></span>
        </label>
      </div>
      <div class="details">
        <p class="name"><strong>${fileName}</strong><span class="close-cell">❌</span></p>
        <p class="size">${fileSize}</p>
        <p class="size lastModified">${lastModified}</p>
        <p class="status"><strong>Status: </strong><span class="text">Wating to be processed</span></p>
      </div>`
    lazyLoadImage(cellDiv, thumbnail)

    const cellDivClickHandler = e => {
        if (e.target.classList.contains('close-cell')) {
            // open confirmation box
            // Get the position of the clicked button
            const rect = e.target.getBoundingClientRect();
            let confirmationBoxO = document.querySelector('#confirmationBox');
            const confirmationBox = confirmationBoxO.cloneNode(true); // just to remove all event listener
            confirmationBoxO.parentElement.replaceChild(
                confirmationBox,
                confirmationBoxO
            );
            const fileName = confirmationBox.querySelector('code');
            fileName.innerText = e.target.previousElementSibling.innerText.trim();
            const confirmationBoxRect = confirmationBox.getBoundingClientRect();
            const boxWidth = confirmationBoxRect.width;
            const boxHeight = confirmationBox.height;

            let top = rect.top + window.scrollY + 20 // Default position
            let left = rect.left + window.scrollX

            // Adjust if it overflows the right boundary
            if (left + boxWidth > window.innerWidth) {
                left = window.innerWidth - boxWidth - 30 // 30px margin
            }

            // Adjust if it overflows the bottom boundary
            if (top + boxHeight > window.innerHeight + window.scrollY) {
                top = rect.top + window.scrollY - boxHeight - 10 // Show above the button
            }
            // Position the confirmation box near the button
            confirmationBox.style.top = `${top}px`
            confirmationBox.style.left = `${left}px`

            let confirmationClickHandler = function (e) {
                if (e.target.classList.contains('yes')) {
                    this.removeEventListener('pointerdown', cellDivClickHandler)
                    this.classList.add('exit')
                    this.addEventListener(
                        'animationend',
                        () => {
                            let grid = this.parentElement
                            let batch = grid.closest('[id^="_batch-"]')
                            this.remove()
                            populateCenter.call(batch.id)
                            centralizedImageStore.removeImage(this.id)
                            if (!grid.childElementCount) batch.remove()
                        },
                        { once: true }
                    )
                }
                e.currentTarget.classList.add('hidden')
                e.currentTarget.removeEventListener(
                    'pointerdown',
                    confirmationClickHandler
                )
                fileName.innerText = '';
                e.currentTarget.style.top = 0;
                e.currentTarget.style.left = 0;
            }
            confirmationClickHandler = confirmationClickHandler.bind(
                e.currentTarget
            )
            confirmationBox.addEventListener(
                'pointerdown',
                confirmationClickHandler
            )
            confirmationBox.classList.remove('hidden')
        } else if (e.target.closest('.imagePreview')) {
            if (e.target.matches('.checkmark')) return
            openModal(e.currentTarget)
        }
    }
    // Using Event Delegation
    cellDiv.addEventListener('pointerdown', cellDivClickHandler)
    document.querySelector(`#${batchId} .grid`).append(cellDiv)
}

function getFileDetails(file) {
    function formatDateTime(timestamp) {
        const options = {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        }

        return new Intl.DateTimeFormat('en-US', options).format(
            new Date(timestamp)
        )
    }
    function formatSize(size) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB']
        let index = 0
        while (size >= 1024 && index < units.length - 1) {
            size /= 1024
            index++
        }
        return `${size.toFixed(2)} ${units[index]}`
    }
    return {
        name: file.name,
        size: formatSize(file.size),
        lastModified: formatDateTime(file.lastModified)
    }
}

function resetUI(imageId) {
    const loading = document.querySelector(`#${imageId} .loading`)
    loading.style.display = 'none'
}

function resetCheck(cellNodeList) {
    const sections = {}
    cellNodeList.forEach(cell => {
        cell.querySelector(`input[type="checkbox"]:checked`).checked = false
        sections[cell.closest('section').id] = null
    });
    Object.keys(sections).forEach(sectionId => {
        populateCenter.call(sectionId);
        document.querySelector(`#${sectionId} .batch-checkmark`).previousElementSibling.checked = false;
    });
}

function showProcessedImage(imageId) {
    const imageDetails = centralizedImageStore.getImages({ imageIds: [imageId] })
    if (!imageDetails.length || imageDetails[0].imageId !== imageId || !imageDetails[0].isProcessed) return
    const { thumbnailDimensions, processedSource } = imageDetails[0]
    const cell = document.getElementById(imageId)
    fileToImageUrl(processedSource, thumbnailDimensions).then(imageSrc => {
        const img = cell.querySelector('img');
        img.src = imageSrc;
        cell.setAttribute('data-isProcessed', true)
    }).catch(e => {
        console.log(e)
        console.log(e.target, e.currentTarget)
    })
    const { name, size, lastModified } = getFileDetails(processedSource)
    const [nameInfo, sizeInfo, lastModifiedInfo] = cell.querySelectorAll(`
        #${imageId} .name>strong,
        #${imageId} .size,
        #${imageId} .lastModified
    `)
    nameInfo.innerText = name
    sizeInfo.innerText = size
    lastModifiedInfo.innerText = lastModified
}

taskManager.on("updateUI", (e) => {
    switch (e.type) {
        case "progress":
            document.querySelector(`#${e.imageId} .status .text`).innerText = e.progress.message;
            break;

        case "taskCompleted":
            imageDataToFile(e.imageId, e.processedImage).then(file => {
                centralizedImageStore.updateImageStore(e.imageId, { isProcessed: true, processedSource: file })
                setTimeout(() => {
                    showProcessedImage(e.imageId)
                }, 0);
            })
            resetUI(e.imageId)
            break;

        case "error":
            console.error("error", e);
            break;

        case "batchCompleted":
            console.log("bat", e);
            break;

        case "taskAssigned":
            toastNotification(e.toastMessage)
            break;

        default:
            console.warn("Unknown message type:", e);
    }
})
console.log(taskManager)
if (typeof Worker !== 'undefined') {
    toastNotification('Web Worker: Supported')
} else {
    toastNotification('Web Worker: Not Supported')
}

const fileInput = document.getElementById('fileInput')
const uploadButton = document.getElementById('uploadButton')
const previewList = document.getElementById('previewList')

uploadButton.addEventListener('pointerdown', () => fileInput.click())
const centralizedImageStore = new ImageStore()
console.log(centralizedImageStore)
fileInput.addEventListener('change', () => {
    centralizedImageStore.makeBatch([...fileInput.files]);
    fileInput.value = '';
})