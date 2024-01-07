import { CfnOutput, Duration, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import { AttributeType, Table } from "aws-cdk-lib/aws-dynamodb";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { LambdaIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";

interface IProps {
  removalPolicy: RemovalPolicy;
  restApi: RestApi;
}

export class MessagesConstruct extends Construct {
  constructor(scope: Construct, id: string, props: IProps) {
    super(scope, id);

    const { removalPolicy, restApi } = props;

    const messagesTable = new Table(this, `messages-table`, {
      partitionKey: {
        name: "messageId",
        type: AttributeType.STRING,
      },
      removalPolicy: removalPolicy,
    });

    const messagesBucket = new Bucket(this, "messages-bucket", {
      removalPolicy: removalPolicy,
    });

    const lambdaFunctionCodeEntry = `src/API/messages`;
    const messagesPostLambda = new NodejsFunction(this, "uploader-lambda", {
      functionName: `messages-post-lambda`,
      runtime: Runtime.NODEJS_18_X,
      handler: "handler",
      entry: `${lambdaFunctionCodeEntry}/post.ts`,
      timeout: Duration.seconds(25),
      memorySize: 256,
      bundling: {
        minify: true,
      },
      environment: {
        MESSAGES_BUCKET_NAME: messagesBucket.bucketName,
        MESSAGES_TABLE_NAME: messagesTable.tableName,
      },
    });

    messagesTable.grantWriteData(messagesPostLambda);
    messagesBucket.grantWrite(messagesPostLambda);

    const messagesResource = restApi.root.addResource("messages");

    const messagesPostIntegration = new LambdaIntegration(messagesPostLambda);
    messagesResource.addMethod("POST", messagesPostIntegration);

    new CfnOutput(this, "S3BucketURL", {
      value: messagesBucket.urlForObject(), // bucket URL will be returned.
    });
  }
}
