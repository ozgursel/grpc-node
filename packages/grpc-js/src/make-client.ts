import {ChannelCredentials} from './channel-credentials';
import {ChannelOptions} from './channel-options';
import {Client} from './client';

export interface Serialize<T> { (value: T): Buffer; }

export interface Deserialize<T> { (bytes: Buffer): T; }

export interface MethodDefinition<RequestType, ResponseType> {
  path: string;
  requestStream: boolean;
  responseStream: boolean;
  requestSerialize: Serialize<RequestType>;
  responseSerialize: Serialize<ResponseType>;
  requestDeserialize: Deserialize<RequestType>;
  responseDeserialize: Deserialize<ResponseType>;
  originalName?: string;
}

export interface ServiceDefinition {
  [index: string]: MethodDefinition<object, object>;
}

export interface PackageDefinition { [index: string]: ServiceDefinition; }

/**
 * Map with short names for each of the requester maker functions. Used in
 * makeClientConstructor
 * @private
 */
const requesterFuncs = {
  unary: Client.prototype.makeUnaryRequest,
  server_stream: Client.prototype.makeServerStreamRequest,
  client_stream: Client.prototype.makeClientStreamRequest,
  bidi: Client.prototype.makeBidiStreamRequest
};

export interface ServiceClient extends Client {
  [methodName: string]: Function;
}

export interface ServiceClientConstructor {
  new(address: string, credentials: ChannelCredentials,
      options?: Partial<ChannelOptions>): ServiceClient;
  service: ServiceDefinition;
}

/**
 * Creates a constructor for a client with the given methods, as specified in
 * the methods argument. The resulting class will have an instance method for
 * each method in the service, which is a partial application of one of the
 * [Client]{@link grpc.Client} request methods, depending on `requestSerialize`
 * and `responseSerialize`, with the `method`, `serialize`, and `deserialize`
 * arguments predefined.
 * @param methods An object mapping method names to
 *     method attributes
 * @param serviceName The fully qualified name of the service
 * @param classOptions An options object.
 * @return New client constructor, which is a subclass of
 *     {@link grpc.Client}, and has the same arguments as that constructor.
 */
export function makeClientConstructor(
    methods: ServiceDefinition, serviceName: string,
    classOptions?: {}): ServiceClientConstructor {
  if (!classOptions) {
    classOptions = {};
  }

  class ServiceClientImpl extends Client implements ServiceClient {
    static service: ServiceDefinition;
    [methodName: string]: Function;
  }

  Object.keys(methods).forEach((name) => {
    const attrs = methods[name];
    let methodType: keyof typeof requesterFuncs;
    // TODO(murgatroid99): Verify that we don't need this anymore
    if (typeof name === 'string' && name.charAt(0) === '$') {
      throw new Error('Method names cannot start with $');
    }
    if (attrs.requestStream) {
      if (attrs.responseStream) {
        methodType = 'bidi';
      } else {
        methodType = 'client_stream';
      }
    } else {
      if (attrs.responseStream) {
        methodType = 'server_stream';
      } else {
        methodType = 'unary';
      }
    }
    const serialize = attrs.requestSerialize;
    const deserialize = attrs.responseDeserialize;
    const methodFunc =
        partial(requesterFuncs[methodType], attrs.path, serialize, deserialize);
    ServiceClientImpl.prototype[name] = methodFunc;
    // Associate all provided attributes with the method
    Object.assign(ServiceClientImpl.prototype[name], attrs);
    if (attrs.originalName) {
      ServiceClientImpl.prototype[attrs.originalName] =
          ServiceClientImpl.prototype[name];
    }
  });

  ServiceClientImpl.service = methods;

  return ServiceClientImpl;
}

function partial(
    fn: Function, path: string, serialize: Function,
    deserialize: Function): Function {
  // tslint:disable-next-line:no-any
  return function(this: any, ...args: any[]) {
    return fn.call(this, path, serialize, deserialize, ...args);
  };
}

export type GrpcObject = {
  [index: string]: GrpcObject|ServiceClientConstructor;
};

/**
 * Load a gRPC package definition as a gRPC object hierarchy.
 * @param packageDef The package definition object.
 * @return The resulting gRPC object.
 */
export function loadPackageDefinition(packageDef: PackageDefinition):
    GrpcObject {
  const result: GrpcObject = {};
  for (const serviceFqn in packageDef) {
    if (packageDef.hasOwnProperty(serviceFqn)) {
      const service = packageDef[serviceFqn];
      const nameComponents = serviceFqn.split('.');
      const serviceName = nameComponents[nameComponents.length - 1];
      let current = result;
      for (const packageName of nameComponents.slice(0, -1)) {
        if (!current[packageName]) {
          current[packageName] = {};
        }
        current = current[packageName] as GrpcObject;
      }
      current[serviceName] = makeClientConstructor(service, serviceName, {});
    }
  }
  return result;
}
