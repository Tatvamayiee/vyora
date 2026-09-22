// Layout components
import React from 'react';
import { useAuth } from './hooks/use-auth';
import { LoadingSpinner } from './components/ui/loading-spinner';
import { EmptyState } from './components/ui/empty-state';
import { ErrorMessage } from './components/ui/error-message';

// Screen components
import OwnerLoginScreen from './screens/owner/owner-login-screen';
import ManagerDashboardScreen from './screens/manager/manager-dashboard-screen';
import CashierPosScreen from './screens/cashier/cashier-pos-screen';
import CustomerHomeScreen from './screens/customer/customer-home-screen';
import WarehouseWorkspaceScreen from './screens/warehouse/warehouse-workspace-screen';

// Layout components
import { MainLayout } from './components/layout/main-layout';
import { RoleBasedRoute } from './components/routes/role-based-route';

function App() {
  const { isLoading, isAuthenticated, user } = useAuth();

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Initializing Vyora POS..." />;
  }

  if (!isAuthenticated) {
    return <OwnerLoginScreen />;
  }

  const renderScreen = () => {
    switch (user?.role.name) {
      case 'OWNER':
        return <RoleBasedRoute requiredRole="OWNER">{
          <MainLayout>
            <OwnerDashboardScreen />
          </MainLayout>
        }</RoleBasedRoute>;
      
      case 'MANAGER':
        return <RoleBasedRoute requiredRole="MANAGER">{
          <MainLayout>
            <ManagerDashboardScreen />
          </MainLayout>
        }</RoleBasedRoute>;
      
      case 'CASHIER':
        return <RoleBasedRoute requiredRole="CASHIER">{
          <MainLayout>
            <CashierPosScreen />
          </MainLayout>
        }</RoleBasedRoute>;
      
      case 'WAREHOUSE':
        return <RoleBasedRoute requiredRole="WAREHOUSE">{
          <MainLayout>
            <WarehouseWorkspaceScreen />
          </MainLayout>
        }</RoleBasedRoute>;
      
      case 'CUSTOMER':
        return <RoleBasedRoute requiredRole="CUSTOMER">{
          <MainLayout>
            <CustomerHomeScreen />
          </MainLayout>
        }</RoleBasedRoute>;
      
      default:
        return <div>Invalid user role</div>;
    }
  };

  return renderScreen();
}

export default App;