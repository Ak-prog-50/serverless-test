import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { MessagesConstruct } from "./L3Constructs/messagesConstruct";
import { REMOVAL_POLICY } from "./stack-config";
import { ApiGwSqsConstruct } from "./L3Constructs/apiGWSQSConstruct";

export class ServerlessTestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const apiGWSQSConstruct = new ApiGwSqsConstruct(this, "apiGwSqs", {});

    new MessagesConstruct(this, "messagesConstrcut", {
      removalPolicy: REMOVAL_POLICY,
      sqsQueue: apiGWSQSConstruct.customQueue,
    });
  }
}
