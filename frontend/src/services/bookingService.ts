import type { BookingFormData } from "@/types";

export interface BookingSubmissionResponse {
  success: boolean;
  message: string;
  requestId?: string;
}

/**
 * Service for submitting booking requests.
 * Connects frontend form with backend or API in future development.
 */
export async function submitBookingRequest(
  data: BookingFormData
): Promise<BookingSubmissionResponse> {
  // Validate basic required fields
  if (!data.name || !data.phone || !data.email || !data.service || !data.preferredDate || !data.preferredTime) {
    return {
      success: false,
      message: "Please fill in all required fields.",
    };
  }

  // Artificial short delay for realistic submission UX
  await new Promise((resolve) => setTimeout(resolve, 300));

  const requestId = "REQ-" + Math.random().toString(36).substring(2, 9).toUpperCase();

  return {
    success: true,
    message: "Your booking request has been received.",
    requestId,
  };
}
