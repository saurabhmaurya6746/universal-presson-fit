import { Routes, Route, Navigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ScrollToTop } from "@/components/common/ScrollToTop";
import { Home } from "@/pages/Home";
import { PressOnFitHome } from "@/pages/PressOnFitHome";
import { About } from "@/pages/About";
import { Services } from "@/pages/Services";
import { Gallery } from "@/pages/Gallery";
import { AISizeFinder } from "@/pages/AISizeFinder";
import { FAQ } from "@/pages/FAQ";
import { Contact } from "@/pages/Contact";
import { Booking } from "@/pages/Booking";
import { BrandsPage } from "@/pages/brands/BrandsPage";
import { BrandDetailPage } from "@/pages/brands/BrandDetailPage";
import { BrandDashboardPage } from "@/pages/brand/BrandDashboardPage";
import { BrandChartManagerPage } from "@/pages/brand/BrandChartManagerPage";
import { HowSizingWorks } from "@/pages/HowSizingWorks";
import { PricingPage } from "@/pages/PricingPage";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage";
import { PersonalDashboardPage } from "@/pages/account/PersonalDashboardPage";
import { PersonalSettingsPage } from "@/pages/account/PersonalSettingsPage";
import { BrandSettingsPage } from "@/pages/brand/BrandSettingsPage";
import { AdminPreviewPage } from "@/pages/admin/AdminPreviewPage";
import { AdminSettingsPage } from "@/pages/admin/AdminSettingsPage";
import { AdminBrandSizingChartsPage } from "@/pages/admin/AdminBrandSizingChartsPage";
import { RouteGuard } from "@/components/auth/RouteGuard";
import { BrandPortalRedirect } from "@/components/auth/BrandPortalRedirect";
import { NotFound } from "@/pages/NotFound";

export function App() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <ScrollToTop />
      <Header />
      <main className="flex-1">
        <Routes>
          {/* Universal Platform Route */}
          <Route path="/" element={<PressOnFitHome />} />

          {/* Preserved Aura Nails Salon Routes */}
          <Route path="/studio/aura-nails" element={<Home />} />
          <Route path="/studio" element={<Navigate to="/studio/aura-nails" replace />} />
          <Route path="/about" element={<About />} />
          <Route path="/services" element={<Services />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/booking" element={<Booking />} />

          {/* Nail World Universal Sizing & Brand Routes */}
          <Route path="/ai-nail-size-finder" element={<AISizeFinder />} />
          <Route path="/ai-size-finder" element={<Navigate to="/ai-nail-size-finder" replace />} />
          <Route path="/how-sizing-works" element={<HowSizingWorks />} />
          <Route path="/how-it-works" element={<Navigate to="/how-sizing-works" replace />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/brands" element={<BrandsPage />} />
          <Route path="/brands/:brandId" element={<BrandDetailPage />} />
          <Route path="/brand/login" element={<Navigate to="/login" replace />} />
          <Route path="/brand" element={<BrandPortalRedirect section="dashboard" />} />
          <Route path="/brand/dashboard" element={<BrandPortalRedirect section="dashboard" />} />
          <Route path="/brand/chart-manager" element={<BrandPortalRedirect section="charts" />} />
          <Route path="/brand/settings" element={<BrandPortalRedirect section="settings" />} />
          <Route
            path="/brand/:brandId/dashboard"
            element={
              <RouteGuard allowedRoles={["brand", "admin"]}>
                <BrandDashboardPage />
              </RouteGuard>
            }
          />
          <Route
            path="/brand/:brandId/charts"
            element={
              <RouteGuard allowedRoles={["brand", "admin"]}>
                <BrandChartManagerPage />
              </RouteGuard>
            }
          />
          <Route
            path="/brand/:brandId/settings"
            element={
              <RouteGuard allowedRoles={["brand", "admin"]}>
                <BrandSettingsPage />
              </RouteGuard>
            }
          />

          {/* Customer Auth, Personal Account & Admin Preview Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/account"
            element={
              <RouteGuard allowedRoles={["personal", "brand", "admin"]}>
                <PersonalDashboardPage />
              </RouteGuard>
            }
          />
          <Route
            path="/account/settings"
            element={
              <RouteGuard allowedRoles={["personal", "brand", "admin"]}>
                <PersonalSettingsPage />
              </RouteGuard>
            }
          />
          <Route path="/dashboard" element={<Navigate to="/account" replace />} />
          <Route
            path="/admin"
            element={
              <RouteGuard allowedRoles={["admin"]}>
                <AdminPreviewPage />
              </RouteGuard>
            }
          />
          <Route
            path="/admin/brand-sizing-charts"
            element={
              <RouteGuard allowedRoles={["admin"]}>
                <AdminBrandSizingChartsPage />
              </RouteGuard>
            }
          />
          <Route path="/admin/charts" element={<Navigate to="/admin/brand-sizing-charts" replace />} />
          <Route
            path="/admin/settings"
            element={
              <RouteGuard allowedRoles={["admin"]}>
                <AdminSettingsPage />
              </RouteGuard>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;
