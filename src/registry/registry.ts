import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { REGISTRY_PORT } from "../config";
import crypto from "crypto";


export type Node = { nodeId: number; pubKey: string };

export type RegisterNodeBody = {
  nodeId: number;
  pubKey: string;
};

export type GetNodeRegistryBody = {
  nodes: { nodeId: number; pubKey: string }[];
};

// Liste des nœuds enregistrés
const registeredNodes: Node[] = new Array(10).fill(null);

// Liste des clés privées associées aux nœuds
const privateKeys: Map<number, string> = new Map();

export async function launchRegistry() {

  const _registry = express();
  _registry.use(express.json());
  _registry.use(bodyParser.json());

  // Vérifier si le registre est en ligne
  _registry.get("/status", (req, res) => {
    res.send("live");
  });

  // Enregistrer un nœud
  _registry.post("/registerNode", (req: Request, res: Response) => {
    const { nodeId, pubKey }: RegisterNodeBody = req.body;

    if (nodeId < 0 || nodeId >= 10) {
      return res.status(400).json({ message: "Invalid node ID" });
    }

    if (registeredNodes[nodeId] !== null) {
      return res.status(400).json({ message: "Node already registered" });
    }

    registeredNodes[nodeId] = { nodeId, pubKey };

    return res.status(201).json({ message: "Node registered successfully" });
  });

  // Obtenir la liste des nœuds
  _registry.get("/getNodeRegistry", (req: Request, res: Response) => {
    const response: GetNodeRegistryBody = {
      nodes: registeredNodes.filter((node) => node !== null),
    };
    res.json(response);
  });

  // Obtenir une clé privée
  _registry.get("/getPrivateKey", (req: Request, res: Response) => {
    const nodeId = Number(req.query.nodeId);
    const privateKey = privateKeys.get(nodeId);

    if (privateKey) {
      return res.json({ result: privateKey });
    } else {
      return res.status(404).json({ message: "Node not found" });
    }
  });

  // Démarrer le serveur
  const server = _registry.listen(REGISTRY_PORT, () => {
    console.log(`Registry is listening on port ${REGISTRY_PORT}`);
  });

  return server;
}

// Générer une paire de clés RSA
export function generateKeys(): { pubKey: string; privKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });

  return {
    pubKey: publicKey.export({ type: "spki", format: "pem" }).toString("base64"),
    privKey: privateKey.export({ type: "pkcs1", format: "pem" }).toString("base64"),
  };
}
