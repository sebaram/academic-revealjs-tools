class RevealQR {
    constructor(options = {}) {
        this.qrContainer = document.getElementById('qrcode');
        this.donotshow_slides = this.parseDonotShowSlides(options.hideSlides || []);
        this.baseUrl = this.determineBaseUrl(options.baseUrl);
        this.staticQR = options.staticQR || false;
        this.showPrintButton = options.showPrintButton ?? true;
        this.hideQR = options.hideQR ?? false;
        
        // Bind event handlers
        this.updateQRCode = this.updateQRCode.bind(this);
        
        // Load QR Code library first, then initialize
        this.loadQRCodeLibrary().then(() => {
            this.init();
            this.updateQRCode();
        });
    }

    loadQRCodeLibrary() {
        return new Promise((resolve, reject) => {
            if (window.QRCode) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    parseDonotShowSlides(donotShowSlides) {
        return donotShowSlides.map(slideNum => {
            return slideNum < 0 ? Reveal.getTotalSlides() + slideNum + 1 : slideNum;
        });
    }

    determineBaseUrl(baseUrl) {
        // return current page url if baseUrl is not provided
        if(!baseUrl) {
            return `${window.location.origin}${window.location.pathname}`;
        }
        return baseUrl;
    }

    setPrintButton() {
        const printBtn = document.createElement('button');
        printBtn.innerHTML = 'Print PDF';
        printBtn.style.cssText = `
            margin-top: 10px;
            padding: 5px 10px;
            font-size: 0.8em;
            background: #666;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        `;
        printBtn.onclick = () => {
            window.open(window.location.pathname + '?print-pdf', '_blank');
        };
        this.qrContainer.innerHTML = ''; // Clear previous content
        this.qrContainer.appendChild(printBtn);
    }

    updateQRCode() {
        
        if(this.hideQR) {
            if(this.showPrintButton) {
                this.qrContainer.style.display = 'block';
                this.setPrintButton();
                return;
            }
            this.qrContainer.style.display = 'none';
            return;
        }

        const indices = Reveal.getIndices();
        const currentSlide = indices.h;
        const verticalSlide = indices.v;
        const totalSlides = Reveal.getTotalSlides();
        
        // hide QR code if current slide is in donotshow_slides
        if(this.donotshow_slides.includes(currentSlide)) {
            this.qrContainer.style.display = 'none';
            return;
        }

        this.qrContainer.style.display = 'block';
        // Include vertical index if it exists (not 0 or undefined)
        const slidePath = verticalSlide > 0 ? `/${currentSlide}/${verticalSlide}` : `/${currentSlide}`;
        const slideUrl = this.staticQR ? this.baseUrl : `${this.baseUrl}#${slidePath}`;
        
        // Clear previous QR code
        this.qrContainer.innerHTML = '<div style="font-weight: bold; font-size: 1.2rem;">[Slide Link]</div>';
        
        // Generate new QR code
        new QRCode(this.qrContainer, {
            text: slideUrl,
            width: 100,
            height: 100,
            correctLevel: QRCode.CorrectLevel.L
        });
    }

    init() {
        // Add event listeners only if not using static QR
        if (!this.staticQR) {
            Reveal.addEventListener('slidechanged', this.updateQRCode);
            Reveal.addEventListener('ready', this.updateQRCode);
        }

        // Handle print mode
        if (window.location.search.includes('print-pdf')) {
            this.qrContainer.style.display = 'none';
        } else if (this.showPrintButton) {
            // Add print button only if showPrintButton is true
            
        }
    }
}
