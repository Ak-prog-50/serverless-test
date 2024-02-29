import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { MessagesConstruct } from "./L3Constructs/messagesConstruct";
import { REMOVAL_POLICY } from "./stack-config";
import { ApiGwSqsConstruct } from "./L3Constructs/apiGWSQSConstruct";
import { ResponseHandlerConstruct } from "./L3Constructs/responseHandlerConstruct";

export class ServerlessTestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const apiGWSQSConstruct = new ApiGwSqsConstruct(this, "apiGwSqs", {});
    // const responseHandlerConstruct = new ResponseHandlerConstruct(
    //   this,
    //   "responseHandler",
    //   {}
    // );

    new MessagesConstruct(this, "messagesConstrcut", {
      removalPolicy: REMOVAL_POLICY,
      msgsPostRouteQueue: apiGWSQSConstruct.customQueue,
      // responseQueue: responseHandlerConstruct.responseQueue,
    });
  }
}
