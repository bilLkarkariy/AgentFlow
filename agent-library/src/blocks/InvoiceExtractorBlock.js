"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceExtractorBlock = void 0;
const uuid_1 = require("uuid");
class InvoiceExtractorBlock {
    s3;
    constructor(s3) {
        this.s3 = s3;
    }
    async run(input) {
        const matches = input.match(/INV-\d+/g) || [];
        const extracted = matches.join(', ');
        const key = `invoices/${(0, uuid_1.v4)()}.txt`;
        await this.s3.uploadData(Buffer.from(extracted, 'utf-8'), key);
        return this.s3.generatePresignedUrl(key);
    }
}
exports.InvoiceExtractorBlock = InvoiceExtractorBlock;
//# sourceMappingURL=InvoiceExtractorBlock.js.map