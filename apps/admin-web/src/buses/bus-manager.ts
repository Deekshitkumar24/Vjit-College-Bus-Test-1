import { BusStatus, CreateBusDto, UpdateBusDto, BusResponseDto } from '@collegebus/contracts';

export interface BusItem extends BusResponseDto {
  active_route_name?: string;
  device_status?: 'ONLINE' | 'OFFLINE' | 'NO_DEVICE';
}

export class BusManager {
  private buses: Map<string, BusItem> = new Map();

  constructor(initialBuses: BusItem[] = []) {
    for (const bus of initialBuses) {
      this.buses.set(bus.id, { ...bus });
    }
  }

  public createBus(dto: CreateBusDto): BusItem {
    // Validate uniqueness of bus_number
    for (const b of this.buses.values()) {
      if (b.bus_number.toUpperCase() === dto.bus_number.trim().toUpperCase()) {
        throw new Error(`Bus with number ${dto.bus_number} already exists`);
      }
      if (b.license_plate.toUpperCase() === dto.license_plate.trim().toUpperCase()) {
        throw new Error(`Bus with license plate ${dto.license_plate} already exists`);
      }
    }

    const id = `bus-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();
    const newBus: BusItem = {
      id,
      bus_number: dto.bus_number.trim(),
      license_plate: dto.license_plate.trim(),
      capacity: dto.capacity,
      model: dto.model ?? null,
      status: dto.status ?? 'ACTIVE',
      active_device_id: null,
      active_route_id: null,
      created_at: now,
      updated_at: now,
    };

    this.buses.set(id, newBus);
    return { ...newBus };
  }

  public updateBus(id: string, dto: UpdateBusDto): BusItem {
    const bus = this.buses.get(id);
    if (!bus) {
      throw new Error(`Bus with ID ${id} not found`);
    }

    if (dto.bus_number) {
      for (const b of this.buses.values()) {
        if (b.id !== id && b.bus_number.toUpperCase() === dto.bus_number.trim().toUpperCase()) {
          throw new Error(`Bus with number ${dto.bus_number} already exists`);
        }
      }
      bus.bus_number = dto.bus_number.trim();
    }

    if (dto.license_plate) {
      for (const b of this.buses.values()) {
        if (b.id !== id && b.license_plate.toUpperCase() === dto.license_plate.trim().toUpperCase()) {
          throw new Error(`Bus with license plate ${dto.license_plate} already exists`);
        }
      }
      bus.license_plate = dto.license_plate.trim();
    }

    if (dto.capacity !== undefined) {
      bus.capacity = dto.capacity;
    }
    if (dto.model !== undefined) {
      bus.model = dto.model;
    }
    if (dto.status !== undefined) {
      bus.status = dto.status;
    }

    bus.updated_at = new Date().toISOString();
    return { ...bus };
  }

  public getBus(id: string): BusItem | null {
    const b = this.buses.get(id);
    return b ? { ...b } : null;
  }

  public listBuses(filter?: { status?: BusStatus; search?: string }): BusItem[] {
    let result = Array.from(this.buses.values());

    if (filter?.status) {
      result = result.filter((b) => b.status === filter.status);
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase().trim();
      result = result.filter(
        (b) =>
          b.bus_number.toLowerCase().includes(q) ||
          b.license_plate.toLowerCase().includes(q) ||
          (b.model && b.model.toLowerCase().includes(q)),
      );
    }

    return result.map((b) => ({ ...b }));
  }

  public linkDevice(busId: string, deviceId: string): void {
    const bus = this.buses.get(busId);
    if (!bus) {
      throw new Error(`Bus with ID ${busId} not found`);
    }
    bus.active_device_id = deviceId;
    bus.updated_at = new Date().toISOString();
  }

  public unlinkDevice(busId: string): void {
    const bus = this.buses.get(busId);
    if (!bus) {
      throw new Error(`Bus with ID ${busId} not found`);
    }
    bus.active_device_id = null;
    bus.updated_at = new Date().toISOString();
  }
}
