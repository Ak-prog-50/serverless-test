import { IQueue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

interface IProps {}

/**
 * Creates a SNS Topic, SQS Queue, Lambda AppSync websocket API
 */
export class ResponseHandlerConstruct extends Construct {
  readonly responseQueue: IQueue;
  constructor(scope: Construct, id: string, props: IProps) {
    super(scope, id);
  }
}
