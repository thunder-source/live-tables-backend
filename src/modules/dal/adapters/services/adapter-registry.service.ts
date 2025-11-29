import { Injectable, Type } from '@nestjs/common';
import { IDatabaseAdapter } from '../interfaces/database-adapter.interface';

@Injectable()
export class AdapterRegistryService {
  private adapters = new Map<string, Type<IDatabaseAdapter>>();

  register(type: string, adapterClass: Type<IDatabaseAdapter>) {
    this.adapters.set(type, adapterClass);
  }

  getAdapterClass(type: string): Type<IDatabaseAdapter> | undefined {
    return this.adapters.get(type);
  }

  createAdapter(type: string): IDatabaseAdapter {
    const AdapterClass = this.getAdapterClass(type);
    if (!AdapterClass) {
      throw new Error(`No adapter registered for type: ${type}`);
    }
    return new AdapterClass();
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.adapters.keys());
  }
}
