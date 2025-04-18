// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    const { jsPDF } = window.jspdf;
    
    // DOM elements
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('fileInput');
    const previewContainer = document.getElementById('previewContainer');
    const convertBtn = document.getElementById('convertBtn');
    const clearBtn = document.getElementById('clearBtn');
    const compressionSlider = document.getElementById('compression');
    const compressionValue = document.getElementById('compressionValue');
    
    // Store uploaded files
    let uploadedFiles = [];
    
    // Event listeners for drag and drop
    dropArea.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', handleFiles);
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropArea.classList.add('highlight');
    }
    
    function unhighlight() {
        dropArea.classList.remove('highlight');
    }
    
    dropArea.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles({ target: { files } });
    }
    
    // Handle selected files
    function handleFiles(e) {
        const files = e.target.files;
        if (files.length === 0) return;
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.match('image.*')) continue;
            
            uploadedFiles.push(file);
            previewFile(file);
        }
    }
    
    // Preview uploaded images
    function previewFile(file) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onloadend = function() {
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            
            const img = document.createElement('img');
            img.src = reader.result;
            img.alt = file.name;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '×';
            removeBtn.addEventListener('click', () => removeFile(file));
            
            previewItem.appendChild(img);
            previewItem.appendChild(removeBtn);
            previewContainer.appendChild(previewItem);
        };
    }
    
    // Remove file from preview
    function removeFile(fileToRemove) {
        uploadedFiles = uploadedFiles.filter(file => file !== fileToRemove);
        previewContainer.innerHTML = '';
        uploadedFiles.forEach(previewFile);
    }
    
    // Clear all files
    clearBtn.addEventListener('click', () => {
        uploadedFiles = [];
        previewContainer.innerHTML = '';
    });
    
    // Update compression value display
    compressionSlider.addEventListener('input', function() {
        compressionValue.textContent = `${Math.round(this.value * 100)}%`;
    });
    
    // Convert to PDF
    convertBtn.addEventListener('click', convertToPDF);
    
    async function convertToPDF() {
        if (uploadedFiles.length === 0) {
            alert('Please upload at least one image');
            return;
        }
        
        const pageSize = document.getElementById('pageSize').value;
        const orientation = document.getElementById('orientation').value;
        const pageSpread = document.getElementById('pageSpread').value;
        const margin = parseInt(document.getElementById('margin').value);
        const borderColor = document.getElementById('borderColor').value;
        const borderWidth = parseInt(document.getElementById('borderWidth').value);
        const compression = parseFloat(compressionSlider.value);
        
        // Create a new PDF document
        const doc = new jsPDF({
            orientation: orientation,
            unit: 'mm',
            format: pageSize
        });
        
        // Process each image
        for (let i = 0; i < uploadedFiles.length; i++) {
            const file = uploadedFiles[i];
            const imgData = await getImageData(file);
            
            // Calculate dimensions based on page size and orientation
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            
            let imgWidth, imgHeight;
            
            // Handle double page spread
            if (pageSpread === 'double' && i % 2 === 0 && i < uploadedFiles.length - 1) {
                const nextImgData = await getImageData(uploadedFiles[i + 1]);
                
                // Create a canvas to combine two images
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculate combined width and height
                const img1 = await loadImage(imgData);
                const img2 = await loadImage(nextImgData);
                
                const ratio1 = img1.width / img1.height;
                const ratio2 = img2.width / img2.height;
                
                const combinedWidth = (pageWidth - margin * 2) * 0.95; // 95% of available width
                const eachWidth = combinedWidth / 2;
                const height1 = eachWidth / ratio1;
                const height2 = eachWidth / ratio2;
                const maxHeight = Math.max(height1, height2);
                
                canvas.width = combinedWidth;
                canvas.height = maxHeight;
                
                // Draw first image
                ctx.drawImage(img1, 0, 0, eachWidth, height1);
                
                // Draw second image
                ctx.drawImage(img2, eachWidth, 0, eachWidth, height2);
                
                // Add border if enabled
                if (borderWidth > 0) {
                    ctx.strokeStyle = borderColor;
                    ctx.lineWidth = borderWidth;
                    ctx.strokeRect(0, 0, canvas.width, canvas.height);
                    ctx.strokeRect(eachWidth, 0, 0, canvas.height); // Line between images
                }
                
                const combinedData = canvas.toDataURL('image/jpeg', compression);
                
                // Add combined image to PDF
                doc.addImage(combinedData, 'JPEG', 
                    margin, 
                    (pageHeight - maxHeight) / 2, 
                    combinedWidth, 
                    maxHeight);
                
                i++; // Skip next image as we've processed it here
            } else {
                // Single image processing
                const img = await loadImage(imgData);
                
                // Calculate dimensions to fit page with margins
                const maxWidth = pageWidth - margin * 2;
                const maxHeight = pageHeight - margin * 2;
                
                let width = img.width;
                let height = img.height;
                
                // Scale down if too large
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }
                
                // Add image to PDF
                doc.addImage(imgData, 'JPEG', 
                    (pageWidth - width) / 2, 
                    (pageHeight - height) / 2, 
                    width, 
                    height, 
                    null, 'FAST');
                
                // Add border if enabled
                if (borderWidth > 0) {
                    doc.setDrawColor(borderColor);
                    doc.setLineWidth(borderWidth / 2); // Adjust for PDF units
                    doc.rect(
                        (pageWidth - width) / 2 - borderWidth / 2, 
                        (pageHeight - height) / 2 - borderWidth / 2, 
                        width + borderWidth, 
                        height + borderWidth
                    );
                }
            }
            
            // Add new page if not last image
            if (i < uploadedFiles.length - 1) {
                doc.addPage(pageSize, orientation);
            }
        }
        
        // Save the PDF
        doc.save('converted_images.pdf');
    }
    
    // Helper function to get image data
    function getImageData(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = function() {
                resolve(reader.result);
            };
        });
    }
    
    // Helper function to load image
    function loadImage(src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = src;
        });
    }
});