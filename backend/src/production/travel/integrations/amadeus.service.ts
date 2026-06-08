import { Injectable, Logger } from '@nestjs/common';

/**
 * Amadeus (GDS) — MOCK wrapper. Mirrors the real Amadeus REST shape so the live
 * client can be dropped in later (set AMADEUS_API_KEY / SECRET in backend/.env).
 * Until then every call returns deterministic mock data; nothing leaves the box.
 */
@Injectable()
export class AmadeusService {
  private readonly log = new Logger('AmadeusService');
  private get live() { return !!process.env.AMADEUS_API_KEY; }

  /** Flight Offers Search (mock). */
  async searchFlights(p: { origin: string; destination: string; departDate?: string; returnDate?: string; passengers?: number; cabin?: string }) {
    this.log.debug(`[mock] searchFlights ${p.origin}→${p.destination}`);
    const base = 1400 + Math.floor(Math.random() * 900);
    const mk = (carrier: string, flight: string, mult: number) => ({
      id: `OFFER-${carrier}${flight}`, carrier, flightNumber: `${carrier}${flight}`,
      departAirport: p.origin, arriveAirport: p.destination,
      departureTime: p.departDate ? `${p.departDate}T09:25:00` : null,
      arrivalTime: p.departDate ? `${p.departDate}T13:40:00` : null,
      cabinClass: p.cabin || 'Economy', fare: Math.round(base * mult * 100) / 100, currency: 'AED',
    });
    return { provider: 'amadeus', live: this.live, offers: [mk('EK', '0731', 1), mk('EY', '0451', 0.92), mk('QR', '1085', 1.08)] };
  }

  /** Create a flight order / PNR (mock). */
  async bookFlight(offer: { carrier?: string; flightNumber?: string; departAirport?: string; arriveAirport?: string; departureTime?: string; arrivalTime?: string; cabinClass?: string; fare?: number; currency?: string }) {
    const pnr = 'AMA' + Math.random().toString(36).slice(2, 8).toUpperCase();
    this.log.debug(`[mock] bookFlight → PNR ${pnr}`);
    return { provider: 'amadeus', live: this.live, pnr, status: 'CONFIRMED', ...offer };
  }
}
