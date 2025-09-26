import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// TypeScript interfaces
export interface Item {
  id: number;
  name: string;
  description: string;
}

export interface ItemCreate {
  name: string;
  description: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

// API service class
export class ApiService {
  // Health check
  async healthCheck(): Promise<{ status: string }> {
    const response = await apiClient.get('/health');
    return response.data;
  }

  // Get all items
  async getItems(): Promise<Item[]> {
    const response = await apiClient.get('/api/items');
    return response.data;
  }

  // Get single item by ID
  async getItem(id: number): Promise<Item> {
    const response = await apiClient.get(`/api/items/${id}`);
    return response.data;
  }

  // Create new item
  async createItem(item: ItemCreate): Promise<Item> {
    const response = await apiClient.post('/api/items', item);
    return response.data;
  }

  // Delete item
  async deleteItem(id: number): Promise<{ message: string }> {
    const response = await apiClient.delete(`/api/items/${id}`);
    return response.data;
  }
}

// Export a singleton instance
export const apiService = new ApiService();

// Default export
export default apiService;
