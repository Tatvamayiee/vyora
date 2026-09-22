// api-service.tsx
import { apiClient } from '../api-client';
import type { Product, Inventory, SaleRequest, Sale, LoyaltyAccount } from '../types';

export class ApiService {
  // Products
  static async getProducts(params: Record<string, any> = {}) {
    return await apiClient.getProducts(params);
  }

  static async getProduct(id: number) {
    return await apiClient.getProduct(id);
  }

  static async createProduct(data: any) {
    return await apiClient.createProduct(data);
  }

  static async updateProduct(id: number, data: any) {
    return await apiClient.updateProduct(id, data);
 }

  static async deleteProduct(id: number) {
    return await apiClient.deleteProduct(id);
  }

  // Inventory
  static async getInventory(params: Record<string, any> = {}) {
    return await apiClient.getInventory(params);
  }

  static async updateInventory(id: number, data: any) {
    return await apiClient.updateInventory(id, data);
  }

  static async updateStock(data: any) {
    return await apiClient.updateStock(data);
  }

  static async getStockMovements(params: Record<string, any> = {}) {
    return await apiClient.getStockMovements(params);
  }

  // Sales
  static async createSale(data: SaleRequest) {
    return await apiClient.createSale(data);
  }

  static async getSales(params: Record<string, any> = {}) {
    return await apiClient.getSales(params);
  }

  static async getSale(id: number) {
    return await apiClient.getSale(id);
  }

  // Staff
  static async getStaff(params: Record<string, any> = {}) {
    return await apiClient.getStaff(params);
  }

  static async createStaff(data: any) {
    return await apiClient.createStaff(data);
 }

  static async updateStaff(id: number, data: any) {
    return await apiClient.updateStaff(id, data);
  }

  // Branches
  static async getBranches() {
    return await apiClient.getBranches();
  }

  // Promotions
  static async getPromotions(params: Record<string, any> = {}) {
    return await apiClient.getPromotions(params);
  }

  static async createPromotion(data: any) {
    return await apiClient.createPromotion(data);
  }

  static async updatePromotion(id: number, data: any) {
    return await apiClient.updatePromotion(id, data);
  }

  // Loyalty
  static async getLoyalty(customerId: number) {
    return await apiClient.getLoyalty(customerId);
  }

  static async createLoyaltyTransaction(data: any) {
    return await apiClient.createLoyaltyTransaction(data);
  }

  // Reports
  static async getReports(params: Record<string, any> = {}) {
    return await apiClient.getReports(params);
  }

  // Sync
  static async syncOfflineTransaction(data: any) {
    return await apiClient.syncOfflineTransaction(data);
  }

  // Notifications
  static async getNotifications(params: Record<string, any> = {}) {
    return await apiClient.getNotifications(params);
  }

  static async markNotificationRead(id: number) {
    return await apiClient.markNotificationRead(id);
  }
}