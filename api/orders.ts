/**
 * Vercel Function: /api/orders
 *
 * GET: List all orders
 * POST: Place order with strict server-side price verification from catalog,
 *       integer cent arithmetic, free delivery threshold calculation (200.00 PLN),
 *       and payment validation with strict PCI-DSS hygiene (zero CVV persistence).
 * DELETE: Delete order
 */

import { DELIVERY_COST_CENTS, FREE_DELIVERY_THRESHOLD_CENTS } from '../src/domain/cart';
import { toCents } from '../src/domain/money';
import { validatePayment, type PaymentInput, type SafePaymentInfo } from '../src/domain/payment';
import { generateDomainId, type Customer, type Order, type OrderItem } from '../src/domain/schemas';
import { errorResponse, extractResourceId, jsonResponse, parseJsonBody } from '../src/server/http';
import { getRepository } from '../src/server/repository';

interface PlaceOrderItemInput {
  readonly id?: string;
  readonly productId?: string;
  readonly product?: { id?: string };
  readonly quantity: number;
}

interface PlaceOrderRequestBody {
  readonly customer: Customer | { id?: string; name?: string; email?: string };
  readonly items: readonly PlaceOrderItemInput[];
  readonly payment?: PaymentInput;
  readonly paymentMethod?: string;
  readonly paymentDetails?: PaymentInput;
  readonly discountCode?: string;
}

export async function GET(): Promise<Response> {
  try {
    const repo = getRepository();
    const orders = await repo.getOrders();
    return jsonResponse(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return errorResponse('Wystąpił błąd podczas pobierania zamówień.', 500);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await parseJsonBody<PlaceOrderRequestBody>(request);
    if (!body || !body.customer || !body.items || !Array.isArray(body.items)) {
      return errorResponse('Dane zamówienia (klient oraz pozycje koszyka) są wymagane.', 400);
    }

    if (body.items.length === 0) {
      return errorResponse('Koszyk zamówienia nie może być pusty.', 400);
    }

    const repo = getRepository();
    const catalog = await repo.getProducts();

    // 1. Resolve and validate customer
    const customers = await repo.getCustomers();
    let resolvedCustomer: Customer;

    if (body.customer.id) {
      const existing = customers.find((c) => c.id === body.customer.id);
      if (existing) {
        resolvedCustomer = existing;
      } else if (body.customer.name && body.customer.email) {
        resolvedCustomer = {
          id: body.customer.id,
          name: body.customer.name,
          email: body.customer.email,
        };
      } else {
        return errorResponse(`Klient o ID "${body.customer.id}" nie został znaleziony.`, 400);
      }
    } else if (body.customer.name && body.customer.email) {
      resolvedCustomer = {
        id: generateDomainId('cust'),
        name: body.customer.name,
        email: body.customer.email,
      };
    } else {
      return errorResponse('Dane klienta są niekompletne.', 400);
    }

    // 2. Server-side product price & stock validation (strictly ignores client-side prices)
    const validatedItems: OrderItem[] = [];
    let calculatedSubtotalCents = 0;

    for (const itemInput of body.items) {
      const prodId = itemInput.id ?? itemInput.productId ?? itemInput.product?.id;
      if (!prodId) {
        return errorResponse(
          'Pozycja zamówienia nie zawiera poprawnego identyfikatora produktu.',
          400
        );
      }

      const product = catalog.find((p) => p.id === prodId);
      if (!product) {
        return errorResponse(
          `Produkt o identyfikatorze "${prodId}" nie istnieje w katalogu sklepu.`,
          400
        );
      }

      const qty = itemInput.quantity;
      if (!Number.isSafeInteger(qty) || qty <= 0) {
        return errorResponse(`Nieprawidłowa ilość dla produktu "${product.name}".`, 400);
      }

      if (!product.inStock || product.stockQuantity <= 0) {
        return errorResponse(
          `Produkt "${product.name}" jest obecnie niedostępny w magazynie.`,
          400
        );
      }

      if (product.stockQuantity < qty) {
        return errorResponse(
          `Brak wystarczającej ilości produktu "${product.name}" w magazynie (dostępne: ${product.stockQuantity}, żądano: ${qty}).`,
          400
        );
      }

      const lineTotal = product.priceCents * qty;
      calculatedSubtotalCents += lineTotal;

      validatedItems.push({
        id: product.id,
        name: product.name,
        priceCents: product.priceCents,
        quantity: qty,
        category: product.category,
      });
    }

    const subtotalCents = toCents(calculatedSubtotalCents);

    // 3. Discount calculation (e.g. RETRO10 = 10% discount)
    let discountCents = toCents(0);
    if (body.discountCode && body.discountCode.trim().toUpperCase() === 'RETRO10') {
      discountCents = toCents(Math.round(subtotalCents * 0.1));
    }
    const subtotalAfterDiscount = toCents(Math.max(0, subtotalCents - discountCents));

    // 4. Delivery threshold calculation: >= 200.00 PLN (20000 cents) -> 0 PLN; otherwise 15.00 PLN (1500 cents)
    const qualifiesForFreeDelivery = subtotalCents >= FREE_DELIVERY_THRESHOLD_CENTS;
    const deliveryCents = qualifiesForFreeDelivery ? toCents(0) : DELIVERY_COST_CENTS;
    const totalCents = toCents(subtotalAfterDiscount + deliveryCents);

    // 5. Payment validation with PCI-DSS hygiene
    const paymentInput = body.paymentDetails ?? body.payment;
    if (!paymentInput) {
      return errorResponse('Dane płatności są wymagane do złożenia zamówienia.', 400);
    }

    let safePaymentDetails: SafePaymentInfo;
    try {
      safePaymentDetails = validatePayment(paymentInput, { totalCents });
    } catch (payErr) {
      const msg = payErr instanceof Error ? payErr.message : 'Błąd walidacji płatności.';
      return errorResponse(msg, 400);
    }

    let paymentMethodName = body.paymentMethod;
    if (!paymentMethodName) {
      switch (safePaymentDetails.method) {
        case 'card':
          paymentMethodName = 'Karta kredytowa';
          break;
        case 'paypal':
          paymentMethodName = 'PayPal';
          break;
        case 'bitcoin':
          paymentMethodName = 'Bitcoin';
          break;
      }
    }

    // 6. Build Order entity (Zero CVV, masked card)
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').slice(0, 19);

    const newOrder: Order = {
      id: generateDomainId('ord'),
      timestamp,
      customer: resolvedCustomer,
      items: validatedItems,
      subtotalCents,
      deliveryCents,
      totalCents,
      paymentMethod: paymentMethodName,
      paymentDetails: safePaymentDetails,
    };

    const savedOrder = await repo.addOrder(newOrder);

    return jsonResponse(
      {
        success: true,
        order: savedOrder,
      },
      201
    );
  } catch (error) {
    console.error('Error placing order:', error);
    const message =
      error instanceof Error ? error.message : 'Wystąpił błąd podczas składania zamówienia.';
    return errorResponse(message, 500);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const body = await parseJsonBody<{ id?: string }>(request);
    const orderId = extractResourceId(request, body);

    if (!orderId) {
      return errorResponse('Identyfikator zamówienia do usunięcia jest wymagany.', 400);
    }

    const repo = getRepository();
    const deletedId = await repo.deleteOrder(orderId);

    return jsonResponse(
      {
        success: true,
        deletedOrderId: deletedId,
      },
      200
    );
  } catch (error) {
    console.error('Error deleting order:', error);
    const message = error instanceof Error ? error.message : 'Nie udało się usunąć zamówienia.';
    return errorResponse(message, 400);
  }
}
