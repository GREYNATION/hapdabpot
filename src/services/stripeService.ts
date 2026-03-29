import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY not set');
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    });
  }
  return stripeInstance;
}

export interface InvoiceData {
  dealId: number;
  address: string;
  amount: number;
  customerEmail: string;
  customerName: string;
  description?: string;
}

export async function createInvoice(data: InvoiceData): Promise<string | null> {
  try {
    // Create or retrieve customer
    const customers = await getStripe().customers.list({
      email: data.customerEmail,
      limit: 1,
    });

    let customerId: string;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await getStripe().customers.create({
        email: data.customerEmail,
        name: data.customerName,
        metadata: {
          dealId: data.dealId.toString(),
        },
      });
      customerId = customer.id;
    }

    // Create invoice item
    await getStripe().invoiceItems.create({
      customer: customerId,
      amount: Math.round(data.amount * 100), // Convert to cents
      currency: 'usd',
      description: data.description || `Real Estate Deal Fee - ${data.address}`,
      metadata: {
        dealId: data.dealId.toString(),
        address: data.address,
      },
    });

    // Create invoice
    const invoice = await getStripe().invoices.create({
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: 30,
      metadata: {
        dealId: data.dealId.toString(),
        address: data.address,
      },
    });

    if (!invoice.id) {
      throw new Error('Failed to create invoice');
    }

    // Finalize and send invoice
    await getStripe().invoices.finalizeInvoice(invoice.id);
    await getStripe().invoices.sendInvoice(invoice.id);

    console.log(`[Stripe] Invoice ${invoice.id} created and sent for deal ${data.dealId}`);
    return invoice.id;
  } catch (error: any) {
    console.error(`[Stripe] Failed to create invoice:`, error.message);
    return null;
  }
}

export async function getInvoiceStatus(invoiceId: string): Promise<string | null> {
  try {
    const invoice = await getStripe().invoices.retrieve(invoiceId);
    return invoice.status || null;
  } catch (error: any) {
    console.error(`[Stripe] Failed to retrieve invoice ${invoiceId}:`, error.message);
    return null;
  }
}

export async function handleWebhook(
  body: string,
  signature: string
): Promise<{ type: string; dealId?: number } | null> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.warn('[Stripe] Webhook secret not configured');
    return null;
  }

  try {
    const event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
    
    switch (event.type) {
      case 'invoice.paid':
        const invoice = event.data.object as Stripe.Invoice;
        const dealId = invoice.metadata?.dealId;
        
        if (dealId) {
          console.log(`[Stripe] Invoice paid for deal ${dealId}`);
          return {
            type: 'invoice.paid',
            dealId: parseInt(dealId),
          };
        }
        break;
        
      case 'invoice.payment_failed':
        console.log(`[Stripe] Invoice payment failed:`, event.data.object.id);
        return { type: 'invoice.payment_failed' };
        
      case 'invoice.payment_succeeded':
        console.log(`[Stripe] Invoice payment succeeded:`, event.data.object.id);
        return { type: 'invoice.payment_succeeded' };
    }
    
    return null;
  } catch (error: any) {
    console.error(`[Stripe] Webhook error:`, error.message);
    return null;
  }
}

export async function createPaymentLink(dealId: number, amount: number, address: string): Promise<string | null> {
  try {
    const paymentLink = await getStripe().paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Real Estate Deal Fee - ${address}`,
              description: `Fee for deal at ${address}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        dealId: dealId.toString(),
      },
    });
    
    return paymentLink.url;
  } catch (error: any) {
    console.error(`[Stripe] Failed to create payment link:`, error.message);
    return null;
  }
}