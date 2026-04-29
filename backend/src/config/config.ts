import { resolve } from 'path';

const repoRoot = resolve(__dirname, '../../..');

const config = {
  port: process.env.PORT ?? '4000',
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017',
  mongoDbName: process.env.MONGO_DB_NAME ?? 'kendara',
  googleClientId: process.env.GOOGLE_CLIENT_ID!,
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  parserPythonPath: process.env.PARSER_PYTHON_PATH ?? resolve(repoRoot, 'parser/.venv/bin/python'),
  parserScriptPath:
    process.env.PARSER_SCRIPT_PATH ?? resolve(repoRoot, 'parser/horoscope_parser.py'),
  parsePdfTimeoutMs: parseInt(process.env.PARSE_PDF_TIMEOUT_MS ?? '60000', 10),
  parsePdfMaxFileSize: parseInt(process.env.PARSE_PDF_MAX_FILE_SIZE ?? `${10 * 1024 * 1024}`, 10),
};

export default config;
