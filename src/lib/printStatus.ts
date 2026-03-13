import { PrintOrderStatus } from "@prisma/client";

export function getOrderStatusLabel(status: PrintOrderStatus) {
    switch (status) {
        case "UPLOADED":
            return "Uploaded";
        case "PAID":
            return "Paid";
        case "PRINTING":
            return "Printing";
        case "COMPLETED":
            return "Completed";
        case "FAILED":
            return "Failed";
        case "EXPIRED":
            return "Expired";
        default:
            return status;
    }
}
