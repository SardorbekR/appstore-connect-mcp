/**
 * Territory lists for subscription and in-app purchase availability.
 *
 * An `include=availableTerritories` returns only the first 10 territories, so the relationship
 * itself is paged to cover all of them (up to ~175).
 */

import { ASCError, ValidationError } from "../utils/errors.js";
import type { AppStoreConnectClient } from "./client.js";
import type { ASCResponse, Territory } from "./types.js";

export interface AvailableTerritory {
  id: string;
  currency?: string;
}

/**
 * Every territory linked to an availability resource, e.g. `/subscriptionAvailabilities/{id}`.
 */
export async function listAvailableTerritories(
  client: AppStoreConnectClient,
  availabilityPath: string
): Promise<AvailableTerritory[]> {
  const territories: AvailableTerritory[] = [];
  for await (const territory of client.paginate<Territory>(
    `${availabilityPath}/availableTerritories`,
    { limit: 200, "fields[territories]": "currency" }
  )) {
    territories.push({ id: territory.id, currency: territory.attributes?.currency });
  }
  return territories;
}

/**
 * The availability resource ID behind a product's availability relationship, or undefined when
 * the product has no availability yet.
 */
export async function findAvailabilityId(
  client: AppStoreConnectClient,
  relationshipPath: string
): Promise<string | undefined> {
  try {
    const response = await client.get<ASCResponse<{ id: string } | null>>(relationshipPath);
    return response.data?.id;
  } catch (error) {
    if (error instanceof ASCError && error.status === 404) return undefined;
    throw error;
  }
}

/**
 * The territory IDs a product is available in now, for keeping them when only
 * `availableInNewTerritories` changes. Refuses when there is nothing to keep.
 */
export async function currentTerritoryIds(
  client: AppStoreConnectClient,
  relationshipPath: string,
  availabilityCollectionPath: string
): Promise<string[]> {
  const availabilityId = await findAvailabilityId(client, relationshipPath);
  const territories = availabilityId
    ? await listAvailableTerritories(client, `${availabilityCollectionPath}/${availabilityId}`)
    : [];
  if (territories.length === 0) {
    throw new ValidationError(
      "territories is required: this product has no available territories to keep",
      "territories"
    );
  }
  return territories.map((territory) => territory.id);
}
