import swaggerAutogen from "swagger-autogen";

const doc = {
  info: {
    title: "auth service api",
    description: "auto generate swagger docs",
    version: "1.0.0",
  },
  host: "localhost:8081",
  schemes: ["http"],
};

const outputFile = "./swagger-output.json";
const endpointFiles = ["./routes/auth.router.ts"];

swaggerAutogen()(outputFile, endpointFiles, doc);
