/**
 * Shape of the generated OpenAPI operation index (src/openapi/schema-index.json).
 * Produced by scripts/generate-openapi-index.ts.
 */

export interface IndexedParameter {
  name: string;
  required?: true;
  enum?: string[];
  maximum?: number;
  deprecated?: true;
}

export interface IndexedAttribute {
  type: string;
  enum?: string[];
  nullable?: true;
  ref?: string;
}

export interface IndexedRelationship {
  resourceType: string;
  many?: true;
  required?: true;
}

export interface IndexedRequestBody {
  schema: string;
  resourceType?: string;
  requiresId?: true;
  attributes?: Record<string, IndexedAttribute>;
  requiredAttributes?: string[];
  relationships?: Record<string, IndexedRelationship>;
  linkage?: { resourceType: string; many?: true };
  includedTypes?: string[];
}

export interface IndexedOperation {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  operationId: string;
  tag?: string;
  getAction?: "get" | "list";
  parameters?: IndexedParameter[];
  requestBody?: IndexedRequestBody;
  responseMediaType?: string;
  deprecated?: true;
}

export interface OperationIndex {
  specVersion: string;
  operationCount: number;
  operations: IndexedOperation[];
}
