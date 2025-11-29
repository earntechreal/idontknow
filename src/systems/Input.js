export class InputManager {
    constructor(element) {
        this.domElement = element || document.body;
        
        // State
        this.move = { x: 0, z: 0 }; // x=Left/Right, z=Fwd/Back
        this.jumping = false;
        this.looking = { x: 0, y: 0 }; // Delta Look
        this.breaking = false;
        this.placing = false;

        this.touchStart = { x: 0, y: 0 };
        this.lookSpeed = 0.005;

        this.setupTouch();
        this.setupKeyboard();
    }

    setupTouch() {
        const bind = (id, startFn, endFn) => {
            const btn = document.getElementById(id);
            if(!btn) return;
            const start = (e) => { e.preventDefault(); startFn(); };
            const end = (e) => { e.preventDefault(); endFn(); };
            
            btn.addEventListener('touchstart', start, {passive: false});
            btn.addEventListener('touchend', end, {passive: false});
            btn.addEventListener('mousedown', start);
            btn.addEventListener('mouseup', end);
        };

        // D-PAD
        bind('btn-fwd', () => this.move.z = 1, () => this.move.z = 0);
        bind('btn-back', () => this.move.z = -1, () => this.move.z = 0);
        bind('btn-left', () => this.move.x = -1, () => this.move.x = 0);
        bind('btn-right', () => this.move.x = 1, () => this.move.x = 0);
        
        // Actions
        bind('btn-jump', () => this.jumping = true, () => this.jumping = false);
        bind('btn-break', () => this.breaking = true, () => this.breaking = false);
        bind('btn-place', () => this.placing = true, () => this.placing = false);

        // Touch Look (Swipe anywhere)
        document.addEventListener('touchstart', (e) => {
            if(e.target.tagName !== 'BUTTON') {
                this.touchStart.x = e.touches[0].clientX;
                this.touchStart.y = e.touches[0].clientY;
            }
        });

        document.addEventListener('touchmove', (e) => {
            if(e.target.tagName === 'BUTTON') return;
            const dx = e.touches[0].clientX - this.touchStart.x;
            const dy = e.touches[0].clientY - this.touchStart.y;
            
            this.looking.x = dx * this.lookSpeed;
            this.looking.y = dy * this.lookSpeed;

            this.touchStart.x = e.touches[0].clientX;
            this.touchStart.y = e.touches[0].clientY;
        });

        document.addEventListener('touchend', () => {
            this.looking.x = 0;
            this.looking.y = 0;
        });
    }

    setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            switch(e.code) {
                case 'KeyW': this.move.z = 1; break;
                case 'KeyS': this.move.z = -1; break;
                case 'KeyA': this.move.x = -1; break;
                case 'KeyD': this.move.x = 1; break;
                case 'Space': this.jumping = true; break;
            }
        });
        document.addEventListener('keyup', (e) => {
            switch(e.code) {
                case 'KeyW': case 'KeyS': this.move.z = 0; break;
                case 'KeyA': case 'KeyD': this.move.x = 0; break;
                case 'Space': this.jumping = false; break;
            }
        });
    }

    // Call this at end of frame to reset single-frame triggers
    resetFrame() {
        this.breaking = false;
        this.placing = false;
        this.looking.x = 0;
        this.looking.y = 0;
    }
}

