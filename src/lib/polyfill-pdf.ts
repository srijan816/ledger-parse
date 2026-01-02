
// Minimal polyfill for DOMMatrix needed by pdfjs-dist
if (typeof global.DOMMatrix === 'undefined') {
    class DOMMatrix {
        a = 1;
        b = 0;
        c = 0;
        d = 1;
        e = 0;
        f = 0;

        constructor(init?: string | number[]) {
            if (Array.isArray(init)) {
                this.a = init[0];
                this.b = init[1];
                this.c = init[2];
                this.d = init[3];
                this.e = init[4];
                this.f = init[5];
            }
        }

        multiply(other: DOMMatrix) {
            return new DOMMatrix([
                this.a * other.a + this.b * other.c,
                this.a * other.b + this.b * other.d,
                this.c * other.a + this.d * other.c,
                this.c * other.b + this.d * other.d,
                this.e * other.a + this.f * other.c + this.e,
                this.e * other.b + this.f * other.d + this.f
            ]);
        }
    }
    (global as any).DOMMatrix = DOMMatrix;
}
