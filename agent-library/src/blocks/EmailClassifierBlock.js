"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailClassifierBlock = void 0;
const uuid_1 = require("uuid");
const zod_1 = require("zod");
const toOpenAITool_1 = require("./toOpenAITool");
class EmailClassifierBlock {
    s3;
    static asTool() {
        return (0, toOpenAITool_1.toOpenAITool)({
            name: 'EmailClassifierBlock',
            description: 'Classify email content into categories and return presigned URL.',
            schema: zod_1.z.object({ text: zod_1.z.string() }),
        });
    }
    constructor(s3) {
        this.s3 = s3;
    }
    async run(input) {
        let category;
        if (/invoice/i.test(input)) {
            category = 'invoice';
        }
        else if (/urgent|asap|important/i.test(input)) {
            category = 'urgent';
        }
        else {
            category = 'other';
        }
        const result = JSON.stringify({ category });
        const key = `classifications/${(0, uuid_1.v4)()}.json`;
        await this.s3.uploadData(Buffer.from(result, 'utf-8'), key);
        return this.s3.generatePresignedUrl(key);
    }
}
exports.EmailClassifierBlock = EmailClassifierBlock;
//# sourceMappingURL=EmailClassifierBlock.js.map