/**
 * Device Tools - Manage registered devices
 */

import type { AppStoreConnectClient } from "../api/client.js";
import type { ASCListResponse, ASCResponse, Device } from "../api/types.js";
import { formatErrorResponse } from "../utils/errors.js";
import {
  getDeviceInputSchema,
  listDevicesInputSchema,
  validateInput,
} from "../utils/validation.js";

/**
 * List all registered devices
 */
export async function listDevices(client: AppStoreConnectClient, input: unknown): Promise<unknown> {
  try {
    const params = validateInput(listDevicesInputSchema, input);

    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
      "fields[devices]": "name,platform,udid,deviceClass,status,model,addedDate",
    };

    if (params.platform) {
      queryParams["filter[platform]"] = params.platform;
    }

    if (params.status) {
      queryParams["filter[status]"] = params.status;
    }

    const response = await client.get<ASCListResponse<Device>>("/devices", queryParams);

    return {
      success: true,
      data: response.data.map((device) => ({
        id: device.id,
        name: device.attributes.name,
        platform: device.attributes.platform,
        udid: device.attributes.udid,
        deviceClass: device.attributes.deviceClass,
        status: device.attributes.status,
        model: device.attributes.model,
        addedDate: device.attributes.addedDate,
      })),
      meta: {
        total: response.meta?.paging?.total,
        returned: response.data.length,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Get a specific device
 */
export async function getDevice(client: AppStoreConnectClient, input: unknown): Promise<unknown> {
  try {
    const params = validateInput(getDeviceInputSchema, input);

    const response = await client.get<ASCResponse<Device>>(`/devices/${params.deviceId}`, {
      "fields[devices]": "name,platform,udid,deviceClass,status,model,addedDate",
    });

    const device = response.data;

    return {
      success: true,
      data: {
        id: device.id,
        name: device.attributes.name,
        platform: device.attributes.platform,
        udid: device.attributes.udid,
        deviceClass: device.attributes.deviceClass,
        status: device.attributes.status,
        model: device.attributes.model,
        addedDate: device.attributes.addedDate,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Tool definitions for devices
 */
export const devicesToolDefinitions = [
  {
    name: "list_devices",
    description:
      "List all registered devices in App Store Connect. Can filter by platform and status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of devices to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
        platform: {
          type: "string",
          enum: ["IOS", "MAC_OS", "TV_OS", "VISION_OS"],
          description: "Filter by platform",
        },
        status: {
          type: "string",
          enum: ["ENABLED", "DISABLED"],
          description: "Filter by device status",
        },
      },
      required: [],
    },
  },
  {
    name: "get_device",
    description: "Get details of a specific registered device.",
    inputSchema: {
      type: "object" as const,
      properties: {
        deviceId: {
          type: "string",
          description: "The device resource ID",
        },
      },
      required: ["deviceId"],
    },
  },
];
