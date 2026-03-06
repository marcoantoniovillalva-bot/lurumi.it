/**
 * Carica pdfjs-dist da CDN usando un <script type="module"> nativo.
 * pdfjs-dist v5 è pure-ESM e webpack non riesce a fare il dynamic import
 * (Object.defineProperty called on non-object in __webpack_require__.r).
 * Il browser native ESM bypassa webpack completamente.
 */

const PDFJS_VERSION = '5.4.624';
const PDFJS_CDN = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`;
const WORKER_CDN = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

let _promise: Promise<any> | null = null;

export function loadPdfjs(): Promise<any> {
    if (typeof window === 'undefined') {
        return Promise.reject(new Error('pdfjs: server-side non supportato'));
    }

    // Già caricato e disponibile globalmente
    if ((window as any).__pdfjsLib) {
        return Promise.resolve((window as any).__pdfjsLib);
    }

    // Riusa la promise già in corso (evita script doppi)
    if (_promise) return _promise;

    _promise = new Promise<any>((resolve, reject) => {
        const eventName = '__pdfjsReady_' + PDFJS_VERSION.replace(/\./g, '_');

        const onReady = () => {
            const lib = (window as any).__pdfjsLib;
            if (lib) resolve(lib);
            else reject(new Error('pdfjs: libreria non disponibile dopo il caricamento'));
        };

        window.addEventListener(eventName, onReady, { once: true });

        const script = document.createElement('script');
        script.type = 'module';
        // Il template literal usa ${} per la sostituzione al momento della creazione del loader,
        // non a runtime nel browser — i valori sono già inseriti come stringhe statiche.
        script.textContent = [
            `import * as pdfjsLib from '${PDFJS_CDN}';`,
            `pdfjsLib.GlobalWorkerOptions.workerSrc = '${WORKER_CDN}';`,
            `window.__pdfjsLib = pdfjsLib;`,
            `window.dispatchEvent(new Event('${eventName}'));`,
        ].join('\n');

        script.onerror = (e) => {
            _promise = null;
            window.removeEventListener(eventName, onReady);
            reject(new Error('pdfjs: impossibile caricare da CDN'));
        };

        document.head.appendChild(script);
    });

    return _promise;
}
