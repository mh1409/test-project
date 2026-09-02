import { randomUUID } from 'node:crypto';
import type { ShipmentStatus } from '@souq/types';

export interface RateQuoteInput {
  origin: { country: string; city?: string };
  destination: { country: string; city?: string; region?: string };
  weightGrams: number;
  dimensionsMm?: { l: number; w: number; h: number };
  declaredValue: number;
  currency: string;
}
export interface RateQuote {
  provider: string;
  serviceCode: string;
  serviceName: string;
  amount: number;
  currency: string;
  minDays: number;
  maxDays: number;
}
export interface CreateShipmentInput extends RateQuoteInput {
  serviceCode: string;
  reference: string;
  recipient: { name: string; phone: string; addressLine: string };
}
export interface ProviderShipment {
  provider: string;
  trackingNumber: string;
  labelUrl: string;
  estimatedDeliveryAt: Date;
}
export interface TrackingEventDto {
  status: ShipmentStatus;
  description: string;
  location?: string;
  occurredAt: Date;
}

export interface ShippingProvider {
  readonly name: string;
  quote(input: RateQuoteInput): Promise<RateQuote[]>;
  createShipment(input: CreateShipmentInput): Promise<ProviderShipment>;
  track(trackingNumber: string): Promise<TrackingEventDto[]>;
  cancel(trackingNumber: string): Promise<void>;
}
export const SHIPPING_PROVIDER = Symbol('SHIPPING_PROVIDER');

export class MockShippingProvider implements ShippingProvider {
  readonly name = 'mock';
  private readonly shipments = new Map<string, { created: Date; events: TrackingEventDto[] }>();

  async quote(input: RateQuoteInput): Promise<RateQuote[]> {
    const kg = Math.max(1, Math.ceil(input.weightGrams / 1000));
    const intl = input.origin.country !== input.destination.country;
    const base = intl ? 4500 : 1500;
    return [
      { provider: this.name, serviceCode: 'standard', serviceName: 'Standard', amount: base + (kg - 1) * 300, currency: input.currency, minDays: intl ? 7 : 2, maxDays: intl ? 14 : 5 },
      { provider: this.name, serviceCode: 'express', serviceName: 'Express', amount: base * 2 + (kg - 1) * 500, currency: input.currency, minDays: intl ? 3 : 1, maxDays: intl ? 5 : 2 },
    ];
  }

  async createShipment(input: CreateShipmentInput): Promise<ProviderShipment> {
    const trackingNumber = `MCK${Date.now().toString(36).toUpperCase()}${randomUUID().slice(0, 6).toUpperCase()}`;
    const days = input.serviceCode === 'express' ? 2 : 4;
    this.shipments.set(trackingNumber, { created: new Date(), events: [{ status: 'LABEL_CREATED', description: 'Label created', occurredAt: new Date() }] });
    return { provider: this.name, trackingNumber, labelUrl: `https://labels.mock.local/${trackingNumber}.pdf`, estimatedDeliveryAt: new Date(Date.now() + days * 86400_000) };
  }

  async track(trackingNumber: string): Promise<TrackingEventDto[]> {
    return this.shipments.get(trackingNumber)?.events ?? [];
  }

  async cancel(trackingNumber: string): Promise<void> {
    const s = this.shipments.get(trackingNumber);
    if (s) s.events.push({ status: 'CANCELLED', description: 'Shipment cancelled', occurredAt: new Date() });
  }
}
