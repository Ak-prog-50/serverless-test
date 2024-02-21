import { env } from "process";
import * as dotenv from "dotenv";
import { RemovalPolicy } from "aws-cdk-lib";
dotenv.config();

export const { ENVIRONMENT } = env;

export const REMOVAL_POLICY =
  ENVIRONMENT === "dev" ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN;
