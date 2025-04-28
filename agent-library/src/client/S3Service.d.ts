export interface S3Config {
    endpoint: string;
    region?: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
}
export declare class S3Service {
    private client;
    private bucket;
    constructor(config: S3Config);
    generatePresignedUrl(key: string, expiresIn?: number): Promise<string>;
    uploadData(data: Buffer, key: string): Promise<void>;
}
