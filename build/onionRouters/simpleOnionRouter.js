"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.simpleOnionRouter = simpleOnionRouter;
const body_parser_1 = __importDefault(require("body-parser"));
const express_1 = __importDefault(require("express"));
const config_1 = require("../config");
async function simpleOnionRouter(nodeId) {
    const onionRouter = (0, express_1.default)();
    onionRouter.use(express_1.default.json());
    onionRouter.use(body_parser_1.default.json());
    // Implement the /status route
    onionRouter.get("/status", (req, res) => {
        res.send("live");
    });
    const port = config_1.BASE_ONION_ROUTER_PORT + nodeId;
    const server = onionRouter.listen(port, () => {
        console.log(`Onion router ${nodeId} is listening on port ${port}`);
    });
    return server;
}
