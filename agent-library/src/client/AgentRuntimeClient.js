"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRuntimeClient = void 0;
const grpc = __importStar(require("@grpc/grpc-js"));
const protoLoader = __importStar(require("@grpc/proto-loader"));
const node_path_1 = __importDefault(require("node:path"));
const PROTO_PATH = node_path_1.default.resolve(__dirname, '../../../../proto/agent.proto');
class AgentRuntimeClient {
    host;
    client;
    constructor(host = process.env.AGENT_RUNTIME_GRPC_HOST ?? 'localhost:50051') {
        this.host = host;
        const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true,
        });
        const proto = grpc.loadPackageDefinition(packageDefinition);
        this.client = new proto.agent.AgentService(host, grpc.credentials.createInsecure());
    }
    run(request) {
        return new Promise((resolve, reject) => {
            const call = this.client.Run();
            let output = '';
            call.on('data', (res) => {
                output += `${res.token} `;
            });
            call.on('error', reject);
            call.on('end', () => resolve(output.trim()));
            call.write({ prompt: request.prompt, parameters: request.parameters ?? {} });
            call.end();
        });
    }
}
exports.AgentRuntimeClient = AgentRuntimeClient;
//# sourceMappingURL=AgentRuntimeClient.js.map