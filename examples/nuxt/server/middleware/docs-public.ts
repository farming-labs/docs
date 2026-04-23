import { defineDocsPublicHandler } from "@farming-labs/nuxt/server";
import config from "../../docs.config";

export default defineDocsPublicHandler(config, useStorage);
