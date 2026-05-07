import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth-options";
import { db } from "@/db/index";
import { users, transactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { authenticateRequest, hasScope } from "@/lib/auth";
import { getTransactions } from "@/lib/billing";
import { weiToEthString } from "@/lib/billing-runtime";

export async function GET(request: NextRequest) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const endUserId = url.searchParams.get("endUserId");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const recentTransactions = await getTransactions(
    endUserId || undefined,
    limit,
    offset,
  );

  const enriched = recentTransactions.map((tx) => ({
    ...tx,
    // ETH convenience fields derived from stored wei
    amountEth: weiToEthString(BigInt(tx.amountWei)),
    ownerChargeEth: tx.ownerChargeWei ? weiToEthString(BigInt(tx.ownerChargeWei)) : null,
    // Expose validated pipeline/model and gateway attribution
    pipeline: tx.pipeline ?? null,
    modelId: tx.modelId ?? null,
    attributionSource: tx.attributionSource ?? null,
    gatewayRequestId: tx.gatewayRequestId ?? null,
    paymentMetadataVersion: tx.paymentMetadataVersion ?? null,
    pipelineModelConstraintHash: tx.pipelineModelConstraintHash ?? null,
    priceValidationStatus: tx.priceValidationStatus ?? null,
    advertisedPriceWeiPerUnit: tx.advertisedPriceWeiPerUnit ?? null,
    signedPriceWeiPerUnit: tx.signedPriceWeiPerUnit ?? null,
    ethUsdPrice: tx.ethUsdPrice ?? null,
    ethUsdSource: tx.ethUsdSource ?? null,
    ethUsdObservedAt: tx.ethUsdObservedAt ?? null,
    networkFeeUsdMicros: tx.networkFeeUsdMicros ?? null,
    ownerChargeUsdMicros: tx.ownerChargeUsdMicros ?? null,
  }));

  return NextResponse.json({
    transactions: enriched,
    pagination: { limit, offset, hasMore: recentTransactions.length === limit },
  });
}

async function getAdminUser(request: NextRequest) {
  const oauthSession = await getServerSession(authOptions);
  if (oauthSession?.user) {
    const sessionUser = oauthSession.user as Record<string, unknown>;
    if (sessionUser.id) {
      const rows = await db
        .select()
        .from(users)
        .where(eq(users.id, sessionUser.id as string))
        .limit(1);
      const user = rows[0];
      if (user?.role !== "admin") return null;
      return user;
    }
  }

  const auth = await authenticateRequest(request);
  if (auth && hasScope(auth.scopes, "admin") && auth.userId) {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1);
    const user = rows[0];
    if (user?.role !== "admin") return null;
    return user;
  }

  return null;
}
