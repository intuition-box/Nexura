import logger from "@/config/logger";
import { cvModel } from "@/models/cv.models";
import { firstMessage } from "@/models/msg.model";
import { referredUsers } from "@/models/referrer.model";
import { token } from "@/models/tokens.model";
import { campaignQuest, miniQuest, quest } from "@/models/quests.model";
import { user } from "@/models/user.model";
import { hub } from "@/models/hub.model";
import { TNSProvider } from "@samoris/tns-sdk";
import { tokenModel } from "@/models/tokenModel";
import {
  performIntuitionOnchainAction,
  serverWalletAddress,
} from "@/utils/account";
import {
  BOT_TOKEN,
  network,
  STUDIO_FEE_CONTRACT,
  THIRD_PARTY_API_KEY,
} from "@/utils/env.utils";
import {
  INTERNAL_SERVER_ERROR,
  OK,
  BAD_REQUEST,
  FORBIDDEN,
  NOT_FOUND,
  UNAUTHORIZED,
  NO_CONTENT,
} from "@/utils/status.utils";
import {
  Client,
  UserPaginator,
  type PaginatedResponse,
  type Schemas,
} from "@xdevplatform/xdk";
import axios from "axios";
import { uploadImg } from "@/utils/img.utils";
import { timer } from "@/models/twitterTimer.model";
import { REDIS } from "@/utils/redis.utils";
import { submission } from "@/models/submission.model";
import {
  campaignQuestCompleted,
  miniQuestCompleted,
  questCompleted,
} from "@/models/questsCompleted.models";
import { atomIds, GRAPHQL_API_URL, RELIC_CONTRACT } from "@/utils/constants";
import { GraphQLClient } from "graphql-request";
import { checksumAddress, formatEther, parseAbi, parseEther, type Address } from "viem";
import { campaign, campaignCompleted } from "@/models/campaign.model";
import { dailySignIn } from "@/models/dailySignIn.model";
import {
  startOfDayUTC,
  updateLevel,
  getNFT,
  getAmountPaid,
} from "@/utils/utils";
import chain from "@/utils/chain.utils";
import { evaluateDailyStreak } from "@/utils/streak.utils";
import { lesson, lessonCompleted } from "@/models/lesson.model";
import { xpLog } from "@/models/xpLog.model";
import { formatDate } from "date-fns";
import { ensureQuestStarted } from "./quest.controller";

const client = new GraphQLClient(GRAPHQL_API_URL);

export const home = async (req: GlobalRequest, res: GlobalResponse) => {
  res.send("hi!");
};

export const getStudioPaymentConfig = async (
  _req: GlobalRequest,
  res: GlobalResponse,
) => {
  res.status(OK).json({
    network,
    contractAddress: STUDIO_FEE_CONTRACT,
    chainId: network === "mainnet" ? "0x483" : "0x350b",
    amount: network === "mainnet" ? "60" : "0.1",
    campaignAmount: network === "mainnet" ? "1000" : "1",
    authorizedAddress: serverWalletAddress,
  });
};

const getTrustNameProvider = () => {
  let provider: TNSProvider | null = null;

  if (!provider) {
    provider = new TNSProvider();
  }

  return provider;
};

export const getUserPNL = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const formattedAddress = checksumAddress(req.user.address);

    const query = `query GetAccountPnlCurrent($input: GetAccountPnlCurrentInput!) {
      getAccountPnlCurrent(input: $input) {
        account_id
        timestamp
        equity_value
        total_assets_in
        total_assets_out
        net_invested
        total_pnl
        pnl_pct
        unrealized_pnl
      }
    }`;

    let getAccountPnlCurrent: any = null;
    try {
      ({ getAccountPnlCurrent } = await client.request(query, { input: { account_id: formattedAddress } }));
    } catch { /* NO_DATA for this account -> return zeros */ }

    const positionsQuery = `query GetAccountPositionCount($address: String!) {
      positions_with_value_aggregate(
        where: {account_id: {_eq: $address}, shares: {_gt: "0"}, term: { type: { _eq: "Triple" } }}
      ) {
        aggregate {
          count
        }
      }
    }`;

    const { positions_with_value_aggregate: { aggregate: { count: positions } } } = await client.request(positionsQuery, { address: formattedAddress });

    const pnlData = getAccountPnlCurrent ?? {};
    const data = {
      portfolio_value: pnlData.equity_value ? parseFloat(formatEther(pnlData.equity_value)).toFixed(4) : "0",
      pnl: pnlData.total_pnl ? parseFloat(formatEther(pnlData.total_pnl)).toFixed(4) : "0",
      roi: pnlData.pnl_pct ? parseFloat(pnlData.pnl_pct).toFixed(1) : "0",
      positions: positions ?? 0
    }


    res.status(OK).json(data);
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching user intuition pnl" })
  }
};

export const getPositions = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const formattedAddress = checksumAddress(req.user.address);

    const query = `query GetPortfolioViewPositionsWithValue($limit: Int, $offset: Int, $orderBy: [positions_with_value_order_by!], $where: positions_with_value_bool_exp, $userPositionAddress: String) {
      positions_with_value(
        limit: $limit
        offset: $offset
        order_by: $orderBy
        where: $where
      ) {
        id
        created_at
        updated_at
        account_id
        account {
          id
          atom_id
          image
          label
        }
        shares
        term_id
        curve_id
        theoretical_value
        total_deposit_assets_after_total_fees
        total_redeem_assets_for_receiver
        redeemable_assets
        pnl
        pnl_pct
        vault {
          curve_id
          term_id
          current_share_price
          created_at
          total_assets
          total_shares
          updated_at
          market_cap
          position_count
        }
        term {
          type
          defaultVault: vaults(where: {curve_id: {_eq: 1}}, limit: 1) {
            curve_id
            total_shares
          }
          triple {
            term_id
            counter_term_id
            subject {
              data
              term_id
              label
              image
              emoji
              type
            }
            predicate {
              data
              term_id
              label
              image
              emoji
              type
            }
            object {
              data
              term_id
              label
              image
              emoji
              type
            }
            term {
              vaults(order_by: {curve_id: asc}) {
                curve_id
                term_id
                current_share_price
                userPosition: positions(
                  limit: 1
                  where: {account_id: {_eq: $userPositionAddress}}
                ) {
                  shares
                  account_id
                }
              }
            }
            counter_term {
              vaults(order_by: {curve_id: asc}) {
                curve_id
                term_id
                current_share_price
                userPosition: positions(
                  limit: 1
                  where: {account_id: {_eq: $userPositionAddress}}
                ) {
                  shares
                  account_id
                }
              }
            }
          }
        }
      }
    }
    `;

    // FILTERS
    // pnl (asc) - worst pnl
    // pnl (desc) - best pnl
    // updated_at (desc) - newest
    // updated_at (asc) - oldest
    // redeemable_assets (desc) - highest value
    // redeemable_assets (asc) - lowest value

    // FILTERS (optional). Defaults to highest value first when no valid sort is given.
    const ALLOWED_SORT_FIELDS = new Set(["pnl", "pnl_pct", "updated_at", "redeemable_assets"]);
    const entries = Object.entries(req.query || {}).filter(([k]) => k !== 'limit' && k !== 'offset' && k !== 'curve') as [string, any][];
    const [rawKey, rawValue] = entries[0] ?? [];
    const key = rawKey && ALLOWED_SORT_FIELDS.has(rawKey) ? rawKey : "redeemable_assets";
    const value = rawValue === "asc" || rawValue === "desc" ? rawValue : "desc";
    
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    // Optional curve filter (Linear=1, Exponential=2)
    const curveParam = req.query.curve as string | undefined;
    const where: Record<string, unknown> = { account_id: { _eq: formattedAddress }, shares: { _gt: "0" } };
    if (curveParam === "1" || curveParam === "2") {
      where.curve_id = { _eq: curveParam };
    }

    const { positions_with_value } = await client.request(query, {
      limit,
      offset,
      orderBy: [{ [key]: value }, { id: "asc" }],
      where,
      userPositionAddress: formattedAddress
    });

    const updatedPostions = [];

    for (const positions of positions_with_value) { 
      if (!positions.term.triple) continue;

      updatedPostions.push(positions);
    }

    res.status(OK).json({ positions: updatedPostions });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching user postions" });
  }
}

export const getIntuitionAccountActivity = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const formattedAddress = checksumAddress(req.user.address);

    const query = `query MyIntuitionActivity($userAddress: String!, $limit: Int = 10, $offset: Int = 0) {
      events(
        limit: $limit
        offset: $offset
        order_by: {created_at: desc}
        where: {_and: [{type: {_neq: "FeesTransfered"}}, {_not: {_and: [{type: {_eq: "Deposited"}}, {deposit: {assets_after_fees: {_eq: 0}}}]}}, {_or: [{_and: [{type: {_eq: "AtomCreated"}}, {atom: {creator: {id: {_eq: $userAddress}}}}]}, {_and: [{type: {_eq: "TripleCreated"}}, {triple: {creator: {id: {_eq: $userAddress}}}}]}, {_and: [{type: {_eq: "Deposited"}}, {deposit: {sender: {id: {_eq: $userAddress}}}}]}, {_and: [{type: {_eq: "Redeemed"}}, {redemption: {sender: {id: {_eq: $userAddress}}}}]}]}]}
      ) {
        id
        block_number
        created_at
        type
        transaction_hash
        atom_id
        triple_id
        deposit_id
        redemption_id
        atom {
          term_id
          data
          image
          cached_image {
            ...CachedImageFields
          }
          label
          type
          wallet_id
          creator {
            id
            label
            image
            cached_image {
              ...CachedImageFields
            }
          }
        }
        triple {
          term_id
          creator {
            label
            image
            cached_image {
              ...CachedImageFields
            }
            id
            atom_id
            type
          }
          subject {
            term_id
            data
            image
            cached_image {
              ...CachedImageFields
            }
            label
            type
          }
          predicate {
            term_id
            data
            image
            cached_image {
              ...CachedImageFields
            }
            label
            type
          }
          object {
            term_id
            data
            image
            cached_image {
              ...CachedImageFields
            }
            label
            type
          }
        }
        deposit {
          assets_after_fees
          curve_id
          term_id
          sender {
            id
            label
          }
        }
        redemption {
          assets
          curve_id
          term_id
          sender {
            id
            label
          }
        }
      }
    }

      fragment CachedImageFields on cached_images_cached_image {
        url
        safe
      }
    `;

    const actLimit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const actOffset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    const { events } = await client.request(query, { userAddress: formattedAddress, limit: actLimit, offset: actOffset });

    res.status(OK).json({ events });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching user intuition activity" })
  }
}

export const validateTrustNameTask = async (
  req: GlobalRequest,
  res: GlobalResponse,
) => {
  try {
    const {
      campaignId: campaignIdFromBody,
      questId: questIdFromBody,
    }: { campaignId?: string; questId?: string } = req.body;
    const id =
      (req.query.id as string) ||
      (req.body.id as string) ||
      (req.body.questId as string);
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "Quest ID is required" });
      return;
    }

    // Try to find if it's a campaign quest or a mini quest
    let parentId = campaignIdFromBody || questIdFromBody;
    let isCampaign = !!campaignIdFromBody;

    const campaignQuestData = await campaignQuest.findById(id).lean();
    const miniQuestData = !campaignQuestData
      ? await miniQuest.findById(id).lean()
      : null;

    if (!campaignQuestData && !miniQuestData) {
      res.status(NOT_FOUND).json({ error: "task not found" });
      return;
    }

    if (campaignQuestData) {
      parentId = parentId || campaignQuestData.campaign?.toString();
      isCampaign = true;
    } else if (miniQuestData) {
      parentId = parentId || miniQuestData.quest?.toString();
      isCampaign = false;
    }

    if (!parentId) {
      res
        .status(BAD_REQUEST)
        .json({ error: "id and (campaignId or questId) are required" });
      return;
    }

    const filter = isCampaign
      ? { campaignQuest: id, campaign: parentId, user: req.id }
      : { miniQuest: id, quest: parentId, user: req.id };

    const Model = isCampaign
      ? (campaignQuestCompleted as any)
      : (miniQuestCompleted as any);
    const taskExists = await Model.findOne(filter);

    const provider = getTrustNameProvider();

    const hasTrustName = await provider.lookupAddress(req.user.address);

    if (!hasTrustName) {
      if (!taskExists) {
        await Model.create({
          ...filter,
          done: false,
          status: "retry",
        });
      } else {
        taskExists.done = false;
        taskExists.status = "retry";

        await taskExists.save();
      }

      res.status(BAD_REQUEST).json({ error: "You don't have a Trust Name" });
      return;
    }

    // Non-campaign tasks stay CLAIMABLE (user presses Claim XP); campaign tasks
    // complete on verify (they use a separate claim path).
    const tnsState = isCampaign
      ? { done: true, status: "done" }
      : { done: false, status: "approved" };
    if (!taskExists) {
      await Model.create({
        ...filter,
        ...tnsState,
      });
    } else {
      taskExists.done = tnsState.done;
      taskExists.status = tnsState.status;

      await taskExists.save();
    }

    // Mini-quest (non-campaign) tasks claim through claimQuest, which needs the
    // overall quest-completion record; campaign tasks use a separate claim path.
    if (!isCampaign) {
      await ensureQuestStarted(parentId, req.id);
    }

    await user.findByIdAndUpdate(req.id, { trustName: hasTrustName, username: hasTrustName });

    res
      .status(OK)
      .json({ message: "user has a trust name and completed the task" });
  } catch (error) {
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error validating trust name task" });
  }
};

export const allowNexonsMint = async (
  req: GlobalRequest,
  res: GlobalResponse,
) => {
  try {
    const { id } = req;

    const level = req.body.level;

    const minter = await user.findById(id).lean();
    if (!minter) {
      res.status(NOT_FOUND).json({ error: "user not found" });
      return;
    }

    if (minter.badges.includes(level)) {
      res.status(OK).json({ message: "already minted" });
      return;
    }

    try {
      await performIntuitionOnchainAction({
        action: "allow-mint",
        level: level.toString(),
        userId: id!,
      });
    } catch (error) {
      console.error(error);
    }

    res.status(OK).json({ message: "allow user to mint successfully" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "internal server error" });
  }
};

export const setApproved = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    await user.updateOne({ _id: req.id }, { isApproved: true });

    res.status(OK).json({ message: "user approved" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Internal Server Error" });
  }
};

export const updateUser = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const profilePicBuffer = req.file?.buffer;

    const { username }: { username: string } = req.body;

    const userToUpdate = await user.findById(req.id);
    if (!userToUpdate) {
      res.status(BAD_REQUEST).json({ error: "invalid user id" });
      return;
    }

    if (profilePicBuffer) {
      const profilePic = await uploadImg({
        filename: req.file?.originalname,
        file: profilePicBuffer,
        folder: "profile-pictures",
      });

      userToUpdate.profilePic = profilePic;
    }

    if (userToUpdate.username !== username) {
      const usernameExists = await user.findOne({ username }).lean();
      if (usernameExists) {
        res.status(BAD_REQUEST).json({ error: "username already taken" });
        return;
      }
    }

    userToUpdate.username = username;

    await userToUpdate.save();

    const userReferred = await referredUsers.findOne({
      newUser: userToUpdate._id,
    });
    if (userReferred) {
      userReferred.username = username;
      await userReferred.save();
    }

    res.status(OK).json({ message: "user updated!" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error updating user" });
  }
};

export const claimDepositXp = async (
  req: GlobalRequest,
  res: GlobalResponse,
) => {
  try {
    const { transactionHash } = req.body;
    const { id } = req;

    if (!transactionHash) {
      res
        .status(BAD_REQUEST)
        .json({ error: "transaction hash and trust amount are required" });
      return;
    }

    const { value, from } = await getAmountPaid(transactionHash);

    if (Number(value) < 200) {
      res
        .status(FORBIDDEN)
        .json({ error: "amount paid must be at least 200 to claim xp" });
      return;
    }

    const trustUser = await user.findById(id);
    if (!trustUser) {
      res.status(BAD_REQUEST).json({ error: "user not found" });
      return;
    }

    if (trustUser.address !== from.toLowerCase()) {
      res
        .status(FORBIDDEN)
        .json({ error: "transaction must be from the user's address" });
      return;
    }

    const date = new Date();
    const exactDate = date.toISOString().split("T")[0];

    if (trustUser.dailyTrustXpDate === exactDate) {
      res
        .status(OK)
        .json({ message: "xp for claim already made today", success: true });
      return;
    }

    const depositXp = 500;

    trustUser.dailyTrustXpDate = exactDate as string;
    trustUser.xp += depositXp;

    await xpLog.create({
      address: trustUser.address,
      amount: depositXp,
      username: trustUser.username,
      status: "success",
      type: "deposit-xp",
    });

    await trustUser.save();

    res.status(OK).json({ message: "xp claim successful", success: true });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error adding claim xp" });
  }
};

export const getTriple = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { termId } = req.query as { termId: string };
    const appUser = await user.findOne({ _id: req.id });

    const query = `
      query GetTripleTerm($termId: String!, $userPositionAddress: String!) {
        triple_term(term_id: $termId) {
          term_id
          counter_term_id
          total_assets
          total_market_cap
          total_position_count
          term {
            total_assets
            positions_aggregate {
              aggregate {
                count
              }
            }
            vaults(order_by: {curve_id: asc}) {
              curve_id
              current_share_price
              total_shares
              total_assets
              position_count
              market_cap
              userPosition: positions(
              limit: 1
              where: { account_id: { _eq: $userPositionAddress }}
              ) {
                shares
                account_id
              }
            }
            positions(order_by: [{
              shares: desc
            }]) {
              shares
              curve_id
              account {
                id
                label
                image
              }
            }
            total_assets
            triple {
              subject {
                label
                image
              }
              predicate {
                label
                image
              }
              object {
                label
                image
              }
              creator {
                id
                image
                label
              }
            }
            total_market_cap
          }
          counter_term {
            total_assets
            positions_aggregate {
              aggregate {
                count
              }
            }
            vaults(order_by: {curve_id: asc}) {
              curve_id
              current_share_price
              total_shares
              total_assets
              position_count
              market_cap
              userPosition: positions(
              limit: 1
              where: { account_id: { _eq: $userPositionAddress }}
              ) {
                shares
                account_id
              }
            }
            positions(order_by: [{
              shares: desc
            }]) {
              shares
              curve_id
              account {
                id
                label
                image
              }
            }
            total_assets
            triple {
              subject {
                label
                image
              }
              predicate {
                label
                image
              }
              object {
                label
                image
              }
              creator {
                id
                image
                label
              }
            }
            total_market_cap
          }
        }
      }
    `;

    const response = await client.request(query, {
      termId,
      userPositionAddress: appUser?.address
        ? checksumAddress(appUser.address as `0x${string}`)
        : "...",
    });
    res.status(OK).json(response.triple_term);
  } catch (error) {
    logger.error(error);
    res.send("failed");
  }
};

export const getClaims = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const appUser = await user.findById(req.id);

    let filter: any;
    const filterQuery = req.query.filter as string;
    try {
      filter = JSON.parse(filterQuery || '{"total_market_cap":"desc"}');
    } catch (e) {
      if (filterQuery === "totalMarketCap_desc") {
        filter = { total_market_cap: "desc" };
      } else if (filterQuery === "totalMarketCap_asc") {
        filter = { total_market_cap: "asc" };
      } else if (filterQuery === "positions_desc") {
        filter = { total_position_count: "desc" };
      } else if (filterQuery === "positions_asc") {
        filter = { total_position_count: "asc" };
      } else if (filterQuery === "supportMarketCap_desc" || filterQuery === "opposeMarketCap_desc") {
        filter = { total_assets: "desc" };
      } else if (filterQuery === "supportMarketCap_asc" || filterQuery === "opposeMarketCap_asc") {
        filter = { total_assets: "asc" };
      } else if (filterQuery === "createdAt_desc") {
        // Fallback to total_market_cap or default order for now
        filter = { total_market_cap: "desc" };
      } else if (filterQuery === "createdAt_asc") {
        filter = { total_market_cap: "asc" };
      } else {
        filter = { total_market_cap: "desc" };
      }
    }

    const offset = parseInt(req.query.offset as unknown as string);

    // 1️⃣ Fetch all vaults (slice for pagination)
    const vaultQuery = `
      query GetExploreTriples($where: triple_term_bool_exp, $orderBy: [triple_term_order_by!], $limit: Int, $offset: Int, $userPositionAddress: String) {
        triple_terms(where: $where, order_by: $orderBy, limit: $limit, offset: $offset) {
          term_id
          counter_term_id
          total_assets
          total_market_cap
          total_position_count
          term {
            id
            total_market_cap
            total_assets
            vaults(order_by: {curve_id: asc}) {
              curve_id
              current_share_price
              total_shares
              total_assets
              position_count
              market_cap
              userPosition: positions(
              limit: 1
              where: {account_id: {_eq: $userPositionAddress}}
              ) {
                shares
                account_id
              }
            }
            positions_aggregate {
              aggregate {
                count
              }
            }
            triple {
              term_id
              counter_term_id
              created_at
              subject_id
              predicate_id
              object_id
              subject {
                term_id
                wallet_id
                label
                image
                cached_image {
                  ...CachedImageFields
                }
                data
                type
                value {
                  ...AtomValueLight
                }
              }
              predicate {
                term_id
                wallet_id
                label
                image
                cached_image {
                  ...CachedImageFields
                }
                data
                type
                value {
                  ...AtomValueLight
                }
              }
              object {
                term_id
                wallet_id
                label
                image
                cached_image {
                  ...CachedImageFields
                }
                data
                type
                value {
                  ...AtomValue
                }
              }
              creator {
                id
                label
                image
                cached_image {
                  ...CachedImageFields
                }
              }
            }
          }
          counter_term {
            id
            total_market_cap
            total_assets
            vaults(order_by: {curve_id: asc}) {
              curve_id
              current_share_price
              total_shares
              total_assets
              position_count
              market_cap
              userPosition: positions(
              limit: 1
              where: {account_id: {_eq: $userPositionAddress}}
              ) {
                shares
                account_id
              }
            }
            positions_aggregate {
              aggregate {
                count
              }
            }
          }
        }
      }

      fragment CachedImageFields on cached_images_cached_image {
        url
        safe
      }

      fragment AtomValueLight on atom_values {
        person {
          name
          image
          cached_image {
            ...CachedImageFields
          }
          url
        }
        thing {
          name
          image
          cached_image {
            ...CachedImageFields
          }
          url
        }
        organization {
          name
          image
          url
        }
        account {
          id
          label
          image
          cached_image {
            ...CachedImageFields
          }
        }
      }


      fragment AtomValue on atom_values {
        ...AtomValueLight
        json_object {
        description: data(path: \"description\")
        }
      }
    `;

    const { triple_terms: claims } = await client.request(vaultQuery, {
      where: {},
      orderBy: [filter],
      limit: 50,
      offset,
      userPositionAddress: appUser?.address
        ? checksumAddress(appUser.address as `0x${string}`)
        : "...",
    });

    res.json({ message: "fetched", claims });
  } catch (e) {
    logger.error(e);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Failed to fetch claims" });
  }
};

export const updateSubmission = async (
  req: GlobalRequest,
  res: GlobalResponse,
) => {
  try {
    const userId = req.id;
    const {
      miniQuestId,
      submissionLink,
    }: { miniQuestId: string; submissionLink: string } = req.body;

    if (!submissionLink || !miniQuestId) {
      res.status(BAD_REQUEST).json({ error: "send the required details" });
      return;
    }

    const task = await submission.findOne({ user: userId, miniQuestId });
    if (!task) {
      res
        .status(BAD_REQUEST)
        .json({ error: "user does not have any submission" });
      return;
    }

    if (task.status === "pending") {
      res
        .status(FORBIDDEN)
        .json({ error: "submission is still pending review" });
      return;
    } else if (task.status === "done") {
      res.status(FORBIDDEN).json({ error: "quest has been marked as done" });
      return;
    }

    let completed;

    if (task.page === "quest") {
      completed = await miniQuestCompleted.findById(task.questCompleted);
      if (!completed) {
        res
          .status(BAD_REQUEST)
          .json({ error: "mini quest completed id is invalid" });
        return;
      }
    } else {
      completed = await campaignQuestCompleted.findById(task.questCompleted);
      if (!completed) {
        res
          .status(BAD_REQUEST)
          .json({ error: "campaign quest completed id is invalid" });
        return;
      }
    }

    completed.status = "pending";
    task.status = "pending";
    task.submissionLink = submissionLink;

    await task.save();
    await completed.save();

    res.status(OK).json({ message: "submission updated!" });
  } catch (error) {
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error updating submission" });
  }
};

export const getLeaderboard = async (
  req: GlobalRequest,
  res: GlobalResponse,
) => {
  try {
    const top500 = await user
      .find()
      .sort({ xp: -1 })
      .limit(500)
      .select(
        "username xp profilePic _id level eventsWon lessonsCompleted questsCompleted campaignsCompleted",
      )
      .lean();

    let rank: number | null = null;

    const me = await user
      .findById(req.id)
      .lean()
      .select("eventsWon questsCompleted createdAt xp campaignsCompleted");

    if (!me) {
      rank = null;
    } else {
      rank =
        (await user.countDocuments({
          $or: [
            { xp: { $gt: me.xp } },
            {
              xp: me.xp,
              createdAt: { $lt: me.createdAt },
            },
          ],
        })) + 1;
    }

    res.status(OK).json({
      message: "leaderboard info fetched",
      rank,
      me,
      leaderboardInfo: top500,
    });
  } catch (error) {
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error fetching leaderboard data" });
  }
};

export const fetchUser = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const userFetched = await user.findById(req.id).lean();

    if (!userFetched) {
      res.status(BAD_REQUEST).json({ error: "invalid user id" });
      return;
    }

    const date = new Date();

    const onlyDate = date.toISOString().split("T")[0];

    const openDailySignIn =
      onlyDate === userFetched.lastSignInDate ? false : true;

    res
      .status(OK)
      .json({ message: "user fetched!", user: userFetched, openDailySignIn });
  } catch (error) {
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error fetching user data" });
  }
};

export const referralInfo = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const id = req.id as string;
    const userFetched = await user.findById(id);

    if (!userFetched) {
      res.status(BAD_REQUEST).json({ error: "invalid user id" });
      return;
    }

    const usersReferred = await referredUsers.find({ user: id }).lean();
    const activeUsers = usersReferred.filter(
      (user: { status: string }) => user.status === "Active",
    );
    if (activeUsers.length >= 10) {
      if (!userFetched.refRewardClaimed && !userFetched.referralAllowed) {
        await performIntuitionOnchainAction({
          action: "allow-ref-reward",
          userId: id,
        });

        userFetched.referralAllowed = true;

        await userFetched.save();
      }
    }

    res.status(OK).json({
      message: "referral info fetched!",
      refRewardClaimed: userFetched.refRewardClaimed,
      usersReferred,
    });
  } catch (error) {
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error fetching referral info" });
  }
};

export const updateBadge = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { level }: { level: number } = req.body;
    const userToUpdate = await user.findById(req.id);

    if (isNaN(level)) {
      res.status(BAD_REQUEST).json({ error: "send level as a number" });
      return;
    }

    if (!userToUpdate) {
      res.status(BAD_REQUEST).json({ error: "invalid user id" });
      return;
    }

    if (!userToUpdate.badges.includes(level)) {
      userToUpdate.badges.push(level);
      userToUpdate.noOfMints = (userToUpdate.noOfMints ?? 0) + 1;

      await userToUpdate.save();

      res.status(OK).json({ message: "badge updated" });
      return;
    }

    res.status(BAD_REQUEST).json({ error: "user already has the badge" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error updating badge" });
  }
};

export const checkRelics = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const questFound = await quest.findById(req.query.questId).lean();
    if (!questFound) {
      res.status(BAD_REQUEST).json({ error: "invalid quest id" });
      return;
    }

    const questAlreadyCompleted = await questCompleted.findOne({ quest: questFound._id, user: req.id }).lean();
    if (questAlreadyCompleted && questAlreadyCompleted?.done) {
      res
        .status(BAD_REQUEST)
        .json({ error: "quest has already been completed" });
      return;
    } else if (questAlreadyCompleted && !questAlreadyCompleted.done) {
      res.status(BAD_REQUEST).json({ error: "claim xp to complete quest" });
      return;
    }

    const nft = await getNFT(req.user.address as string);

    if (!nft) {
      res
        .status(BAD_REQUEST)
        .json({ error: "user does not have relic on connected wallet" });
      return;
    }

    await questCompleted.create({
      done: false,
      category: "one-time",
      quest: questFound._id,
      user: req.id,
    });

    res.status(OK).json({ message: "relics verified", verified: true });
  } catch (error) {
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error checking user address for relics contract" });
  }
};

export const runRelicHodlCheck = async () => {
  try {
    const relicMiniQuests = await miniQuest
      .find({ tag: "relic" })
      .select("quest")
      .lean();

    const rewardByQuestId = new Map<string, number>();
    for (const relicMiniQuest of relicMiniQuests) {
      if (!relicMiniQuest.quest) continue;
      const relicQuest = await quest
        .findById(relicMiniQuest.quest)
        .select("reward")
        .lean();
      if (relicQuest) {
        rewardByQuestId.set(
          relicQuest._id.toString(),
          relicQuest.reward ?? 6000,
        );
      }
    }

    if (rewardByQuestId.size === 0) return;

    const relicQuestIds = [...rewardByQuestId.keys()];
    const claims = await questCompleted.find({
      quest: { $in: relicQuestIds },
      done: true,
    });

    for (const claim of claims) {
      try {
        const reward = rewardByQuestId.get(claim.quest!.toString()) ?? 6000;

        const claimUser = await user.findById(claim.user);
        if (!claimUser) continue;

        const stillHoldsRelic = await getNFT(claimUser.address);
        if (stillHoldsRelic) continue;

        claimUser.xp = Math.max(0, claimUser.xp - reward);
        claimUser.hasRelic = false;
        claimUser.level = await updateLevel(
          claimUser
        );
        await claimUser.save();

        claim.done = false;
        await claim.save();

        await xpLog.create({
          address: claimUser.address,
          amount: -reward,
          username: claimUser.username,
          status: "success",
          type: "quest",
        });
      } catch (error) {
        logger.error(error);
      }
    }
  } catch (error) {
    logger.error(error);
  }
};

export const claimRelicReward = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const questFound = await quest.findById(req.query.questId).lean();
    if (!questFound) {
      res.status(BAD_REQUEST).json({ error: "invalid quest id" });
      return;
    }

    const isQuestCompleted = await questCompleted.findOne({
      quest: questFound._id,
      user: req.id,
    });
    if (!isQuestCompleted) {
      res.status(BAD_REQUEST).json({ error: "verify relic to proceed" });
      return;
    }

    if (isQuestCompleted.done === true) {
      res
        .status(BAD_REQUEST)
        .json({ error: "quest reward has already been claimed" });
      return;
    }

    const questUser = await user.findById(req.id);
    if (!questUser) {
      res.status(BAD_REQUEST).json({ error: "invalid user" });
      return;
    }

    isQuestCompleted.done = true;

    await isQuestCompleted.save();

    // Grant relic reward XP and mark the user as owning a relic
    const rewardAmount = questFound.reward ?? 6000;
    questUser.xp += rewardAmount;
    questUser.hasRelic = true;

    // Recalculate level based on the new XP and badges
    const level = await updateLevel(
      questUser
    );

    questUser.level = level;

    await questUser.save();

    await xpLog.create({
      address: questUser.address,
      amount: rewardAmount,
      username: questUser.username,
      status: "success",
      type: "quest",
    });

    res.status(OK).json({ message: "relic reward claimed successfully" });
  } catch (error) {
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error claiming relic reward" });
  }
};

export const validateAtlasTask = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { id, questId, tag, page } = req.body;
    if (!questId || !id || !tag) {
      res
        .status(BAD_REQUEST)
        .json({ error: "questId, id and tag is required" });
      return;
    }

    const allowedTags = ["i-follow", "i-collaborated", "i-trust", "i-interact"];
    if (!allowedTags.includes(tag)) {
      res.status(BAD_REQUEST).json({ error: "invalid tag" });
      return;
    }

    const userToCheck = await user.findById(req.id);
    if (!userToCheck) {
      res
        .status(BAD_REQUEST)
        .json({ error: "id associated with user is invalid" });
      return;
    }

    const query = `query GetAtomTriples($atomId: String!, $where: triples_bool_exp) {
      atom(term_id: $atomId) {
        label
        as_predicate_triples(where: $where) {
          positions {
            term {
              triple {
                term_id
              }
            }
          }
        }
      }
    }`;

    const atomId = atomIds[tag as string];

    const formattedAddress = checksumAddress(
      userToCheck.address as `0x${string}`,
    );

    const response = await client.request(query, {
      atomId,
      where: {
        positions: {
          account_id: {
            _eq: formattedAddress,
          },
        },
      },
    });

    const { atom } = response;

    if (!atom) {
      res.status(NOT_FOUND).json({ error: "atom id is invalid" });
      return;
    }

    const positionExists = atom.as_predicate_triples?.length > 0;

    if (page !== "campaign") {
      const miniQuestExists = await miniQuestCompleted.findOne({
        miniQuest: id,
        quest: questId,
        user: userToCheck._id,
      });

      if (!miniQuestExists) {
        if (!positionExists) {
          await miniQuestCompleted.create({
            miniQuest: id,
            quest: questId,
            done: false,
            status: "retry",
            user: userToCheck._id,
          });
        } else {
          // Validated on-chain, but XP is claimed manually: mark approved (not done)
          // so the card shows a "Claim XP" button instead of auto-claiming.
          await miniQuestCompleted.create({
            miniQuest: id,
            quest: questId,
            done: false,
            status: "approved",
            user: userToCheck._id,
          });

          await ensureQuestStarted(questId, userToCheck._id);

          res.status(OK).json({ message: "task verified" });
          return;
        }
      } else {
        if (positionExists) {
          miniQuestExists!.done = false;
          miniQuestExists!.status = "approved";

          await miniQuestExists.save();

          await ensureQuestStarted(questId, userToCheck._id);

          res.status(OK).json({ message: "task verified" });
          return;
        }
      }

      res.status(BAD_REQUEST).json({
        error:
          "User has not supported or opposed a claim or shares is less than 5",
      });
      return;
    }

    const campaignQuestExists = await campaignQuestCompleted.findOne({
      campaignQuest: id,
      campaign: questId,
      user: userToCheck._id,
    });

    if (!campaignQuestExists) {
      if (!positionExists) {
        await campaignQuestCompleted.create({
          campaignQuest: id,
          campaign: questId,
          done: false,
          status: "retry",
          user: userToCheck._id,
        });
      } else {
        await campaignQuestCompleted.create({
          campaignQuest: id,
          campaign: questId,
          done: true,
          status: "done",
          user: userToCheck._id,
        });

        res.status(OK).json({ message: "task completed" });
        return;
      }
    } else {
      if (positionExists) {
        campaignQuestExists!.done = true;
        campaignQuestExists!.status = "done";

        await campaignQuestExists.save();

        res.status(OK).json({ message: "task completed" });
        return;
      }
    }

    res.status(BAD_REQUEST).json({
      error:
        "User has not supported or opposed a claim or shares is less than 5",
    });
  } catch (error) {
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error validating atlas task" });
  }
};

export const validatePortalTask = async (
  req: GlobalRequest,
  res: GlobalResponse,
) => {
  try {
    const {
      termId,
      id,
      questId,
      page,
    }: { page: string; termId: string; id: string; questId: string } = req.body;

    const userToCheck = await user.findById(req.id);
    if (!userToCheck) {
      res
        .status(BAD_REQUEST)
        .json({ error: "id associated with user is invalid" });
      return;
    }

    // set shares to be from 1.3
    const query = `
      query GetTriple($id: String!, $address: String!) {
        triple(term_id: $id) {
          positions (where:  {
            account_id:  {
              _eq: $address
            }
            shares:  {
              _gte: 650000000000000000
            }
          }) {
            account_id
          }

          counter_positions (where:  {
            account_id:  {
              _eq: $address
            }
            shares:  {
              _gte: 650000000000000000
            }
          }) {
            account_id
          }
        }
      }
    `; // user needs to atleast support or oppose with 2.5 trust;

    const formattedAddress = checksumAddress(
      userToCheck.address as `0x${string}`,
    );

    const response = await client.request(query, {
      id: termId,
      address: formattedAddress,
    });

    const { triple } = response;

    if (!triple) {
      res.status(NOT_FOUND).json({ error: "term id is invaid" });
      return;
    }

    const supportFound = triple.positions.length;
    const opposeFound = triple.counter_positions.length;

    if (page !== "campaign") {
      const miniQuestExists = await miniQuestCompleted.findOne({
        miniQuest: id,
        quest: questId,
        user: userToCheck._id,
      });

      if (!miniQuestExists) {
        if (!supportFound && !opposeFound) {
          await miniQuestCompleted.create({
            miniQuest: id,
            quest: questId,
            done: false,
            status: "retry",
            user: userToCheck._id,
          });
        } else {
          await miniQuestCompleted.create({
            miniQuest: id,
            quest: questId,
            done: false,
            status: "approved",
            user: userToCheck._id,
          });

          await ensureQuestStarted(questId, userToCheck._id);

          res.status(OK).json({ message: "task verified" });
          return;
        }
      } else {
        if (!supportFound && !opposeFound) {
          miniQuestExists.done = false;
          miniQuestExists.status = "retry";

          await miniQuestExists!.save();
        } else {
          miniQuestExists!.done = false;
          miniQuestExists!.status = "approved";

          await miniQuestExists.save();

          await ensureQuestStarted(questId, userToCheck._id);

          res.status(OK).json({ message: "task completed" });
          return;
        }
      }

      res.status(BAD_REQUEST).json({
        error:
          "User has not supported or opposed a claim or shares is less than 5",
      });
      return;
    } else {
      const campaignQuestExists = await campaignQuestCompleted.findOne({
        campaignQuest: id,
        campaign: questId,
        user: userToCheck._id,
      });

      if (!campaignQuestExists) {
        if (!supportFound && !opposeFound) {
          await campaignQuestCompleted.create({
            campaignQuest: id,
            campaign: questId,
            done: false,
            status: "retry",
            user: userToCheck._id,
          });
        } else {
          await campaignQuestCompleted.create({
            campaignQuest: id,
            campaign: questId,
            done: true,
            status: "done",
            user: userToCheck._id,
          });

          res.status(OK).json({ message: "task completed" });
          return;
        }
      } else {
        if (!supportFound && !opposeFound) {
          campaignQuestExists.done = false;
          campaignQuestExists.status = "retry";

          await campaignQuestExists!.save();
        } else {
          campaignQuestExists!.done = true;
          campaignQuestExists!.status = "done";

          await campaignQuestExists.save();

          res.status(OK).json({ message: "task completed" });
          return;
        }
      }

      res.status(BAD_REQUEST).json({
        error:
          "User has not supported or opposed a claim or shares is less than 5",
      });
    }
  } catch (error) {
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error validating portal task" });
  }
};

export const updateClaims = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const {
      action,
      transactionHash,
    }: { action: "buy" | "sell"; transactionHash: string } = req.body;

    if (!transactionHash && !action) {
      res
        .status(BAD_REQUEST)
        .json({ error: "transaction hash and action are required" });
      return;
    }

    if (action !== "buy" && action !== "sell") {
      res
        .status(BAD_REQUEST)
        .json({ error: "invalid action. action can only be buy or sell" });
      return;
    }

    const userToUpdate = await user.findById(req.id);
    if (!userToUpdate) {
      res.status(NOT_FOUND).json({ error: "user not found" });
      return;
    }

    const { from } = await getAmountPaid(transactionHash);

    if (from.toLowerCase() !== (userToUpdate.address ?? "").toLowerCase()) {
      res
        .status(FORBIDDEN)
        .json({ error: "transaction must be from the user's address" });
      return;
    }

    if (action === "buy") {
      userToUpdate.noOfClaims += 1;
    } else {
      userToUpdate.claimsSold += 1;
    }

    await userToUpdate.save();

    res.status(OK).json({ message: "user claims updated successfully" });
  } catch (error) {
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error updating user claims" });
  }
};

export const updateClaimsCreated = async (
  req: GlobalRequest,
  res: GlobalResponse,
) => {
  try {
    const { txHash }: { txHash: string } = req.body;

    if (!txHash) {
      res.status(BAD_REQUEST).json({ error: "send transaction hash" });
      return;
    }

    const userToUpdate = await user
      .findById(req.id)
      .select("address noOfClaimsCreated");
    if (!userToUpdate) {
      res
        .status(BAD_REQUEST)
        .json({ error: "id associated with user is invalid" });
      return;
    }

    const { from } = await getAmountPaid(txHash);
    if (from.toLowerCase() !== userToUpdate.address) {
      res
        .status(UNAUTHORIZED)
        .json({ error: "tx hash must be from authenticated user" });
      return;
    }

    userToUpdate.noOfClaimsCreated += 1;

    await userToUpdate.save();

    res.status(OK).json({ message: "no of claims created tracked" });
  } catch (error) {
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error updating claims created" });
  }
};

export const getAnalytics = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const usersFound = await user
      .find()
      .select("updatedAt createdAt refRewardClaimed badges status xp")
      .lean();
    const totalReferrals = await referredUsers.countDocuments();

    const totalCampaigns = await campaign.countDocuments({
      $or: [
        { status: { $eq: "Ended" } },
        { status: { $eq: "Active" } },
        { status: { $eq: "Scheduled" } },
      ],
    });

    const totalQuests = await quest.countDocuments({
      $or: [
        { status: { $in: ["Ended", "Active", "Scheduled"] } },
      ],
    });

    const totalQuestsJoined = await questCompleted.countDocuments();

    const soldClaimsAggregate = await user.aggregate([
      {
        $group: {
          _id: null,
          totalClaimsSold: { $sum: "$claimsSold" },
        },
      },
    ]);

    const soldClaims = soldClaimsAggregate[0]?.totalClaimsSold ?? 0;

    const rewardContractDeployed = await campaign.countDocuments({
      contractAddress: { $exists: true },
    });

    const others = rewardContractDeployed + soldClaims;

    const totalQuestsCompleted = await questCompleted.countDocuments({ done: true });

    const totalCampaignsCompletedFound = await campaignCompleted
      .find()
      .select("campaignCompleted questsCompleted")
      .lean();

    const totalCampaignsCompleted = totalCampaignsCompletedFound.filter(
      (c) => c.campaignCompleted === true,
    ).length;

    const totalLessonJoined = await lessonCompleted.countDocuments();

    const lessonsCreated = await lesson.countDocuments({ status: "published" });

    const totalLessonCompleted = await lessonCompleted.countDocuments({ done: true });

    const totalJoined =
      totalQuestsJoined +
      totalLessonJoined +
      totalCampaignsCompletedFound.length;

    const totalCompleted =
      totalQuestsCompleted + totalLessonCompleted + totalCampaignsCompleted;

    const joinRatio = (totalCompleted / totalJoined) * 100;

    const totalUsers = usersFound.length;

    const userOnchainAggregate = await user.aggregate([
      {
        $group: {
          _id: null,
          totalClaims: { $sum: "$noOfClaims" },
        },
      },
    ]);

    const claimsBought = userOnchainAggregate[0]?.totalClaims ?? 0;

    const claimsCreatedAggregate = await user.aggregate([
      {
        $group: {
          _id: null,
          totalClaimsCreated: { $sum: "$noOfClaimsCreated" },
        },
      },
    ]);

    const claimsCreated = claimsCreatedAggregate[0]?.totalClaimsCreated ?? 0;

    const paymentsAggregate = await hub.aggregate([
      {
        $group: {
          _id: null,
          totalPayments: { $sum: "$noOfPayments" },
        },
      },
    ]);

    const payments = paymentsAggregate[0]?.totalPayments ?? 0;

    const aggregateResult = await user.aggregate([
      {
        $group: {
          _id: null,
          totalXp: { $sum: "$xp" },
        },
      },
    ]);

    const totalXpInCirculation = aggregateResult[0]?.totalXp ?? 0;

    const now = new Date();

    const users24h = usersFound.filter((u) => {
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      return u.createdAt >= last24Hours;
    }).length;

    const referralRewardsClaimed = usersFound.filter(
      (u: { refRewardClaimed?: boolean | null }) => {
        return u.refRewardClaimed === true;
      },
    ).length;

    const mintsFromBadges = usersFound.reduce(
      (sum, u: { badges?: number[] }) => {
        return sum + (u.badges?.length ?? 0);
      },
      0,
    );

    const rewardCampaignsTrust = await campaign.aggregate([
      {
        $match: {
          $or: [
            { "reward.pool": { $gt: 0 } },
            { totalTrustAvailable: { $gt: 0 } },
          ],
        },
      },
      {
        $group: {
          _id: null,
          totalTrustDistributed: { $sum: "$trustClaimed" },
        },
      },
    ]);

    const totalTrustDistributed =
      rewardCampaignsTrust[0]?.totalTrustDistributed ?? 0;

    const totalOnchainInteractions = claimsBought + payments + mintsFromBadges;

    const users7d = usersFound.filter((u) => {
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      return u.createdAt >= last7Days;
    }).length;

    const users30d = usersFound.filter((u) => {
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      return u.createdAt >= last30Days;
    }).length;

    const activeUsersDaily = usersFound.filter(
      (u: { updatedAt?: Date | null; status?: string }) => {
        if (!u.updatedAt) return false;
        const last24Hours = now.getTime() - 24 * 60 * 60 * 1000;

        return u.updatedAt.getTime() >= last24Hours;
      },
    ).length;

    const activeUsersWeekly = usersFound.filter(
      (u: { updatedAt?: Date | null; status?: string }) => {
        if (!u.updatedAt) return false;
        const last7Days = now.getTime() - 7 * 24 * 60 * 60 * 1000;

        return u.updatedAt.getTime() >= last7Days;
      },
    ).length;

    const activeUsersMonthly = usersFound.filter(
      (u: { updatedAt?: Date | null; status?: string }) => {
        if (!u.updatedAt) return false;
        const last30Days = now.getTime() - 30 * 24 * 60 * 60 * 1000;

        return u.updatedAt.getTime() >= last30Days;
      },
    ).length;

    const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // ── 30-day buckets (index 0 = 29 days ago, index 29 = today) ──────────────
    const usersByDay = Array.from({ length: 30 }, (_, i) => {
      const dayStart = new Date(now);
      dayStart.setUTCHours(0, 0, 0, 0);
      dayStart.setUTCDate(dayStart.getUTCDate() - (29 - i));
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
      const count = usersFound.filter(
        (u) => u.createdAt >= dayStart && u.createdAt < dayEnd,
      ).length;
      const dayName = DAY_NAMES[dayStart.getUTCDay()];
      const dateLabel = `${dayStart.getUTCMonth() + 1}/${dayStart.getUTCDate()}`;
      return { day: dayName, date: dateLabel, count };
    });

    // ── Rolling 24-hour buckets (index 0 = 23 hours ago, index 23 = current hour) ──
    const currentHourStart = new Date(now);
    currentHourStart.setUTCMinutes(0, 0, 0);
    const todayMidnight = new Date(now);
    todayMidnight.setUTCHours(0, 0, 0, 0);
    const usersByHour = Array.from({ length: 24 }, (_, i) => {
      const hourStart = new Date(
        currentHourStart.getTime() - (23 - i) * 60 * 60 * 1000,
      );
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
      const count = usersFound.filter(
        (u) => u.createdAt >= hourStart && u.createdAt < hourEnd,
      ).length;
      const hourOfDay = hourStart.getUTCHours();
      const label = `${String(hourOfDay).padStart(2, "0")}:00`;
      return { hour: hourOfDay, label, count };
    });

    const tomorrowName =
      DAY_NAMES[new Date(now.getTime() + 24 * 60 * 60 * 1000).getUTCDay()];

    // ── Previous-period counts for % change badges ────────────────────────────
    const prev24hStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const prev24hEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const prev7dStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const prev7dEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prev30dStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const prev30dEnd = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const prevUsers24h = usersFound.filter(
      (u) => u.createdAt >= prev24hStart && u.createdAt < prev24hEnd,
    ).length;
    const prevUsers7d = usersFound.filter(
      (u) => u.createdAt >= prev7dStart && u.createdAt < prev7dEnd,
    ).length;
    const prevUsers30d = usersFound.filter(
      (u) => u.createdAt >= prev30dStart && u.createdAt < prev30dEnd,
    ).length;

    const prevActiveWeekly = usersFound.filter(
      (u: { updatedAt: Date; status: string }) => {
        return u.updatedAt >= prev7dStart && u.updatedAt < prev7dEnd;
      },
    ).length;
    const prevActiveMonthly = usersFound.filter(
      (u: { updatedAt: Date; status: string }) => {
        return u.updatedAt >= prev30dStart && u.updatedAt < prev30dEnd;
      },
    ).length;

    // Total users yesterday (for day-over-day % change)
    const yesterdayMidnight = new Date(
      todayMidnight.getTime() - 24 * 60 * 60 * 1000,
    );
    const totalUsersYesterday = usersFound.filter(
      (u) => u.createdAt < yesterdayMidnight,
    ).length;

    res.status(OK).json({
      message: "analytics data fetched",
      analytics: {
        totalOnchainInteractions,
        totalCampaigns,
        user: {
          totalUsers,
          activeUsersDaily,
          activeUsersWeekly,
          activeUsersMonthly,
          users24h,
          users7d,
          users30d,
          prevUsers24h,
          prevUsers7d,
          prevUsers30d,
          prevActiveWeekly,
          prevActiveMonthly,
          totalUsersYesterday,
        },
        others,
        totalReferrals,
        lessonsCreated,
        claimsCreated,
        claimsBought,
        payments,
        nexonsMinted: mintsFromBadges,
        totalQuests,
        totalQuestsCompleted,
        totalCampaignsCompleted,
        joinRatio,
        totalTrustDistributed,
        totalXpInCirculation,
        usersByDay,
        usersByHour,
        tomorrowName,
      },
    });
  } catch (error) {
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error fetching analytics data" });
  }
};

export const fetchDailyXpDetails = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const month = formatDate(new Date(), "MMM, y");

    const [dailyXpDetailsInDB, userStreakToUpdate] = await Promise.all([
      dailySignIn
        .findOne({ user: req.id, month })
        .lean()
        .select("xpClaimedThisMonth date"),
      user.findById(req.id).select("lastSignInDate streak streakToRestore"),
    ]);

    if (!userStreakToUpdate) {
      res.status(NOT_FOUND).json({ error: "invalid user id" });
      return;
    }

    const xpClaimedThisMonth = dailyXpDetailsInDB?.xpClaimedThisMonth ?? 0;

    const { streakLost } = evaluateDailyStreak(
      userStreakToUpdate.lastSignInDate,
      userStreakToUpdate.streak,
    );

    if (!streakLost) {
      res
        .status(OK)
        .json({
          message: "daily xp details fetched",
          dailyXpDetails: { streakLost, xpClaimedThisMonth },
        });
      return;
    }

    if (userStreakToUpdate.streakToRestore === 0) {
      userStreakToUpdate.streakToRestore = userStreakToUpdate.streak;
      await userStreakToUpdate.save();
    }

    res
      .status(OK)
      .json({
        message: "daily xp details fetched",
        dailyXpDetails: { streakLost, xpClaimedThisMonth },
      });
  } catch (error) {
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error fetching daily xp details" });
  }
};

export const claimStreakReward = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    // Fetch fresh user data from DB to avoid stale req.user values
    const userFromReq = await user.findById(req.id);
    if (!userFromReq) {
      res.status(BAD_REQUEST).json({ error: "user not found" });
      return;
    }

    const month = formatDate(new Date(), "MMM, y");

    let streakReward = 0;

    const currentDayCount: number = userFromReq.dayCount || 0;
    const currentStreak: number = userFromReq.streak || 0;
    let dayCount = currentDayCount;

    let dailyXpReward = await dailySignIn.findOne({ user: req.id, month });

    // Check milestones from HIGHEST to LOWEST so users at higher streaks
    // (e.g. day 15 who never claimed day 7) get the correct reward on first claim.
    if (currentStreak >= 90 && currentDayCount < 90) {
      streakReward = 20000;
      dayCount = 90;
    } else if (currentStreak >= 60 && currentDayCount < 60) {
      streakReward = 10000;
      dayCount = 60;
    } else if (currentStreak >= 45 && currentDayCount < 45) {
      streakReward = 5000;
      dayCount = 45;
    } else if (currentStreak >= 30 && currentDayCount < 30) {
      streakReward = 2500;
      dayCount = 30;
    } else if (currentStreak >= 15 && currentDayCount < 15) {
      streakReward = 1000;
      dayCount = 15;
    } else if (currentStreak >= 7 && currentDayCount < 7) {
      streakReward = 500;
      dayCount = 7;
    }

    if (streakReward === 0) {
      res
        .status(BAD_REQUEST)
        .json({ error: "streak reward not available to claim" });
      return;
    }

    // The dailySignIn record is keyed by {month, user}. When a streak
    // spans a month boundary (e.g. day 7 lands on Feb 1), the new month
    // may not have a record yet — create it instead of crashing.
    if (!dailyXpReward) {
      await dailySignIn.create({
        month,
        user: req.id,
        xpClaimedThisMonth: streakReward,
        date: formatDate(new Date(), "yyyy-MM-dd"),
      });
    } else {
      dailyXpReward.xpClaimedThisMonth += streakReward;
      await dailyXpReward.save();
    }

    await user.findByIdAndUpdate(req.id, {
      $inc: { xp: streakReward },
      $set: { dayCount },
    });

    await xpLog.create({
      amount: streakReward,
      address: req.user.address,
      username: req.user.username,
      type: "daily-xp-streak-reward",
      status: "success",
    });

    res.status(OK).json({ message: "streak reward claimed", streakReward });
  } catch (error) {
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error claiming streak reward" });
  }
};

export const referralLeaderboard = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const referrals = await referredUsers.aggregate([
      {
        $group: {
          _id: "$user",
          totalReferrals: { $sum: 1 },
          activeReferrals: {
            $sum: {
              $cond: [{ $eq: ["$status", "Active"] }, 1, 0],
            },
          },
        },
      },
      {
        $sort: {
          activeReferrals: -1,
          totalReferrals: -1,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
      {
        $project: {
          username: "$user.username",
          profilePic: "$user.profilePic",
          totalReferrals: 1,
          activeReferrals: 1,
        },
      },
    ]);

    const referralLeaderboardInfo = [];

    for (const referral of referrals) {
      const activeReferrals = referral.activeReferrals;

      let xpEarned = 0;
      if (activeReferrals >= 10 && activeReferrals < 20) {
        xpEarned = 2000;
      } else if (activeReferrals >= 20 && activeReferrals < 30) {
        xpEarned = 5000;
      } else if (activeReferrals >= 30) {
        xpEarned = 10000;
      }

      referralLeaderboardInfo.push({ ...referral, xpEarned });
    }

    res
      .status(OK)
      .json({
        message: "referral leaderboard info fetched",
        referralLeaderboardInfo,
      });
  } catch (error) {
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error fetching referral leaderboard info" });
  }
};

export const getUserXpHistory = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const userXpHistory = await xpLog.find({ address: req.user.address });

    res.status(OK).json({ userXpHistory });
  } catch (error) {
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error fetching user xp history" });
  }
};

export const performDailySignIn = async (
  req: GlobalRequest,
  res: GlobalResponse,
) => {
  const userId = req.id;

  const userExists = await user.findById(userId);
  if (!userExists) {
    res.status(NOT_FOUND).json({ message: "User not found" });
    return;
  }

  try {
    const today = startOfDayUTC();
    const yesterday = new Date(today);
    yesterday.setUTCDate(today.getUTCDate() - 1);

    const onlyDate = today.toISOString().split("T")[0] as string;
    const yesterdayDate = yesterday.toISOString().split("T")[0] as string;

    // Source of truth for streak: user.lastSignInDate.
    // The previous version read from dailySignIn.findOne(), but legacy data has
    // duplicate dailySignIn rows for some users (the unique index was added
    // after some rows already existed). findOne returned an arbitrary/old row
    // and the date never matched yesterday — streak reset every day even when
    // the user signed in daily.
    const lastSignIn = userExists.lastSignInDate;

    if (lastSignIn === onlyDate) {
      res.status(BAD_REQUEST).json({ error: "Already signed in today" });
      return;
    }

    if (lastSignIn === yesterdayDate) {
      userExists.streak += 1;
    } else {
      // First sign-in ever, OR a gap of 2+ days — reset to 1.
      userExists.streak = 1;
    }

    const dailyXpAmount = 50;

    const month = formatDate(new Date(), "MMM, y");

    userExists.xp += dailyXpAmount;
    userExists.lastSignInDate = onlyDate;

    if (userExists.streak > userExists.longestStreak) {
      userExists.longestStreak = userExists.streak;
    }

    const level = await updateLevel(
      userExists
    );

    userExists.level = level;
    userExists.totalCheckIns += 1;
    userExists.streakToRestore = 0;

    const dailySignInRecord = await dailySignIn
      .findOne({ month, user: userId })
      .select("xpClaimedThisMonth date");
    if (!dailySignInRecord) {
      await dailySignIn.create({
        month,
        user: userId,
        xpClaimedThisMonth: dailyXpAmount,
        date: onlyDate,
      });
    } else {
      dailySignInRecord.xpClaimedThisMonth += dailyXpAmount;
      dailySignInRecord.date = onlyDate;
      await dailySignInRecord.save();
    }

    await userExists.save();

    await xpLog.create({
      address: userExists.address,
      username: userExists.username,
      amount: dailyXpAmount,
      status: "success",
      type: "daily-xp",
    });

    res.status(OK).json({ message: "Daily sign-in successful", done: true });
  } catch (error) {
    await xpLog.create({
      address: userExists.address,
      username: userExists.username,
      amount: 50,
      status: "failed",
      type: "daily-xp",
    });
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error claiming daily quest" });
  }
};

export const restoreStreak = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const txHash = req.query.transactionHash as string;

    if (!txHash) {
      res.status(BAD_REQUEST).json({ error: "transaction hash is required" });
      return;
    }

    const { from, timestamp, value } = await getAmountPaid(txHash);

    if (
      checksumAddress(from as Address) !== checksumAddress(req.user.address)
    ) {
      res
        .status(BAD_REQUEST)
        .json({ error: "transaction must be from the user's address" });
      return;
    }

    const amount = network === "mainnet" ? "1" : "0.01";

    if (value !== amount) {
      res
        .status(BAD_REQUEST)
        .json({
          error: `user must deposit ${amount} trust before streak can be restored`,
        });
      return;
    }

    const currentDate = new Date().toLocaleDateString("en-US", {
      timeZone: "Africa/Lagos",
    }) as string;

    if (timestamp !== currentDate) {
      res
        .status(BAD_REQUEST)
        .json({ error: "transaction must be from the current day" });
      return;
    }

    const today = startOfDayUTC();

    const date = today.toISOString().split("T")[0] as string;

    const streak = (req.user.streakToRestore += 1);

    await user.findByIdAndUpdate(req.id, {
      $inc: { totalCheckIns: 1, xp: 50 },
      $set: { streak, lastSignInDate: date, streakToRestore: 0 },
    });

    const month = formatDate(new Date(), "MMM, y");

    const dailySignInExists = await dailySignIn.findOne({ user: req.id, month }).select("xpClaimedThisMonth");
    if (!dailySignInExists) {
      await dailySignIn.create({ user: req.id, date, month, xpClaimedThisMonth: 50 });
    } else {
      dailySignInExists.xpClaimedThisMonth += 50;
      await dailySignInExists.save();
    }

    res.status(OK).json({ message: "streak restored" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error restoring streak" });
  }
}

export const searchTriple = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { keyword } = req.body;
    if (!keyword) {
      res.status(BAD_REQUEST).json({ error: "send the search keyword" });
      return;
    }

    const userToFetch = await user.findById(req.id).lean().select("address");

    const query = `
      query GetExploreTriples($where: triple_term_bool_exp, $orderBy: [triple_term_order_by!], $limit: Int, $offset: Int, $userPositionAddress: String) {
        triple_terms(where: $where, order_by: $orderBy, limit: $limit, offset: $offset) {
          term_id
          counter_term_id
          supporter_count
          opposer_count
          total_assets
          total_market_cap
          total_position_count
          term {
            id
            total_market_cap
            total_assets
            vaults(order_by: {curve_id: asc}) {
              curve_id
              current_share_price
              total_shares
              total_assets
              position_count
              market_cap
              userPosition: positions(
                limit: 1
                where: {account_id: {_eq: $userPositionAddress}}
              ) {
                shares
                account_id
              }
            }
            positions_aggregate {
              aggregate {
                count
              }
            }
            triple {
              term_id
              counter_term_id
              created_at
              subject_id
              predicate_id
              object_id
              subject {
                term_id
                wallet_id
                label
                image
                cached_image {
                  ...CachedImageFields
                }
                data
                type
                value {
                  ...AtomValueLight
                }
              }
              predicate {
                term_id
                wallet_id
                label
                image
                cached_image {
                  ...CachedImageFields
                }
                data
                type
                value {
                  ...AtomValueLight
                }
              }
              object {
                term_id
                wallet_id
                label
                image
                cached_image {
                  ...CachedImageFields
                }
                data
                type
                value {
                  ...AtomValue
                }
              }
              subject_term {
                ...TermElement
              }
              predicate_term {
                ...TermElement
              }
              object_term {
                ...TermElementFull
              }
              creator {
                id
                label
                image
                cached_image {
                  ...CachedImageFields
                }
              }
            }
          }
          counter_term {
            id
            total_market_cap
            total_assets
            vaults(order_by: {curve_id: asc}) {
              curve_id
              current_share_price
              total_shares
              total_assets
              position_count
              market_cap
              userPosition: positions(
                limit: 1
                where: {account_id: {_eq: $userPositionAddress}}
              ) {
                shares
                account_id
              }
            }
            positions_aggregate {
              aggregate {
                count
              }
            }
          }
        }
      }

      fragment CachedImageFields on cached_images_cached_image {
        url
        safe
      }

      fragment AtomValueLight on atom_values {
        person {
          name
          image
          cached_image {
            ...CachedImageFields
          }
          url
        }
        thing {
          name
          image
          cached_image {
            ...CachedImageFields
          }
          url
        }
        organization {
          name
          image
          url
        }
        account {
          id
          label
          image
          cached_image {
            ...CachedImageFields
          }
        }
      }

      fragment AtomValue on atom_values {
        ...AtomValueLight
        json_object {
          description: data(path: "description")
        }
      }

      fragment TermElement on terms {
        id
        type
        atom {
          term_id
          data
          image
          cached_image {
            ...CachedImageFields
          }
          label
          emoji
          type
          wallet_id
          value {
            ...AtomValueLight
          }
        }
        triple {
          term_id
          subject {
            label
          }
          predicate {
            label
          }
          object {
            label
          }
        }
      }

      fragment TermElementFull on terms {
        id
        type
        atom {
          term_id
          data
          image
          cached_image {
            ...CachedImageFields
          }
          label
          emoji
          type
          wallet_id
          value {
            ...AtomValue
          }
          creator {
            ...AccountMetadata
          }
        }
        triple {
          term_id
          subject {
            label
          }
          predicate {
            label
          }
          object {
            label
          }
        }
      }

      fragment AccountMetadata on accounts {
        label
        image
        cached_image {
          ...CachedImageFields
        }
        id
        atom_id
        type
      }
    `;

    const response = await client.request(query, {
      where: {
        _and: [
          {
            term: {
              triple: {
                _or: [
                  {
                    subject: {
                      label: {
                        _ilike: `%${keyword}%`,
                      },
                    },
                  },
                  {
                    predicate: {
                      label: {
                        _ilike: `%${keyword}%`,
                      },
                    },
                  },
                  {
                    object: {
                      label: {
                        _ilike: `%${keyword}%`,
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      },
      limit: 50,
      offset: 0,
      orderBy: [
        {
          total_market_cap: "desc",
        },
      ],
      userPositionAddress: userToFetch?.address
        ? checksumAddress(userToFetch.address as `0x${string}`)
        : "...",
    });

    res.status(OK).json(response.triple_terms);
  } catch (error) {
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error searching for claim" });
  }
};

export const claimReferreralReward = async (
  req: GlobalRequest,
  res: GlobalResponse,
) => {
  try {
    const userId = req.id!;

    const { tier }: { tier: number } = req.body;
    if (!tier) {
      res.status(BAD_REQUEST).json({ error: "tier is required" });
      return;
    }

    const referrer = await user.findById(userId);
    if (!referrer) {
      res
        .status(BAD_REQUEST)
        .json({ error: "id associated with user is invalid" });
      return;
    }

    const activeUsersByTier = tier === 1 ? 10 : tier === 2 ? 20 : 30;

    const xpByTier = tier === 1 ? 2000 : tier === 2 ? 3000 : 5000;

    if (referrer.refRewardClaimed) {
      res.status(BAD_REQUEST).json({ error: "referrer reward claimed" });
      return;
    }

    if (referrer.tier === tier) {
      res
        .status(BAD_REQUEST)
        .json({ error: "user is already in the referral tier" });
      return;
    }

    const usersReferred = await referredUsers.countDocuments({
      user: userId,
      status: "Active",
    });

    if (usersReferred < activeUsersByTier) {
      res
        .status(FORBIDDEN)
        .json({ error: "active users threshold hasn't been met!" });
      return;
    }

    let xpGiven = 0;

    if (referrer.tier === 0 && tier === 2) {
      referrer.xp += 5000;
      xpGiven = 5000;
    } else if (referrer.tier === 0 && tier === 3) {
      referrer.xp += 10000;
      xpGiven = 10000;
    } else {
      referrer.xp += xpByTier;
      xpGiven = xpByTier;
    }

    referrer.tier = tier;

    if (tier === 3) {
      referrer.refRewardClaimed = true;
    }

    await xpLog.create({
      address: referrer.address,
      amount: xpGiven,
      username: referrer.username,
      status: "success",
      type: "referral",
    });

    await referrer.save();

    res.status(OK).json({ message: "referral reward claimed!" });
  } catch (error) {
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error claiming referral reward" });
  }
};

const getXClient = ({ token, auth }: { token: string; auth?: string }) => {
  if (auth === "oauth2") {
    return new Client({ accessToken: token });
  }

  return new Client({ bearerToken: token });
};

export const checkXTask = async (req: GlobalRequest, res: GlobalResponse) => {
  const userToCheck = await user.findById(req.id);
  if (!userToCheck) {
    res
      .status(BAD_REQUEST)
      .json({ error: "id associated with user is invalid" });
    return;
  }

  const xId = userToCheck.socialProfiles?.x?.id;
  if (!xId) {
    res.status(BAD_REQUEST).json({ error: "user X account not connected" });
    return;
  }

  const userToken = await token.findOne({ userId: xId });
  if (!userToken) {
    res.status(UNAUTHORIZED).json({
      error:
        "auth tokens not found for user, kindly disconnect X account and login back",
    });
    return;
  }

  const timers = await timer.find();
  const timeToWait = timers[0];

  let xClient: Client;
  let quest: any | undefined = undefined;

  try {
    const { tag, id: postId, questId, page } = req.body; // get task id and store hub x id, then remove hardcoded nexura id

    const NEXURA_ID = "1983300499597393920";
    const NEXURA_USERNAME = "NexuraXYZ";
    if (page === "quest") {
      quest = await miniQuest.findById(questId);
      if (!quest) {
        res.status(NOT_FOUND).json({ error: "quest id is invalid" });
        return;
      }
    } else {
      quest = await campaignQuest.findById(questId);
      if (!quest) {
        res.status(NOT_FOUND).json({ error: "quest id is invalid" });
        return;
      }
    }

    const API_URL = "https://api.twitterapi.io/twitter";

    switch (tag) {
      case "follow":
        const followersArr = [];
        let followDone = false;
        let followCursor = "";

        const followKey = `${NEXURA_USERNAME}:follow`;

        const followersInCache = (await REDIS.get(followKey)) as any;

        const followFound = followersInCache.some(
          (follower: { id: string }) => follower.id === xId,
        );
        if (followFound) {
          res.status(OK).json({ message: "task verified", success: true });
          return;
        }

        if (followersInCache.length < 500) {
          const now = new Date();

          if (timeToWait?.time != null && timeToWait.time > now) {
            res.status(UNAUTHORIZED).json({
              error: "task has not been validated, check back after 1 hr",
            });
            return;
          }

          while (!followDone) {
            const {
              data: { followers, has_next_page, next_cursor },
            } = await axios.get(
              `${API_URL}/user/followers?userName=${NEXURA_USERNAME}&pageSize=200&cursor=${followCursor}`,
              {
                headers: {
                  "X-API-Key": `${THIRD_PARTY_API_KEY}`,
                },
              },
            );

            if (followersArr.length === 500 || followers.length === 0) {
              followDone = true;
              await REDIS.set({ key: followKey, data: followersArr });
            } else {
              followersArr.push(...followers);
              followCursor = next_cursor;
              if (!has_next_page) {
                followDone = true;
                await REDIS.set({ key: followKey, data: followersArr });
              }
            }
          }

          if (!timeToWait) {
            await timer.create({
              time: new Date(now.getTime() + 1 * 60 * 60 * 1000),
            });
          } else {
            timeToWait.time = new Date(now.getTime() + 1 * 60 * 60 * 1000);
            await timeToWait.save();
          }
        }

        followDone = false;
        followCursor = "";

        const isFollowing = followersArr.some(
          (follower: { id: string }) => follower.id === xId,
        );

        if (!isFollowing) {
          res.status(BAD_REQUEST).json({ error: "account not followed" });
          return;
        }

        res.status(OK).json({ message: "task verified", success: true });
        return;
      case "like":
        xClient = getXClient({ token: userToken.accessToken, auth: "oauth2" });

        const likedPosts: UserPaginator = new UserPaginator(
          async (token?: string): Promise<PaginatedResponse<Schemas.Tweet>> => {
            const res = await xClient.users.getLikedPosts(xId, {
              maxResults: 100,
              paginationToken: token,
              userFields: ["id"],
            });

            return {
              data: res.data ?? [],
              meta: res.meta,
              includes: res.includes,
              errors: res.errors,
            };
          },
        );

        await likedPosts.fetchNext();

        for await (const likedPost of likedPosts.users) {
          if (likedPost.id === postId) {
            res.status(OK).json({ message: "task verified", success: true });
            return;
          }

          if (!likedPosts.done) {
            await likedPosts.fetchNext();
          }
        }

        console.log("LE:", likedPosts.errors);

        res.status(BAD_REQUEST).json({ error: "tweet not liked" });
        return;
      case "repost":
        const repostersArr = [];
        let repostDone = false;
        let repostCursor = "";

        const repostKey = `${postId}:repost`;

        const repostInCache = (await REDIS.get(repostKey)) as any;

        const repostFound = repostInCache.some(
          (reposter: { id: string }) => reposter.id === xId,
        );
        if (repostFound) {
          res.status(OK).json({ message: "task verified", success: true });
          return;
        }

        if (repostInCache.length < 500) {
          const now = new Date();

          if (timeToWait?.time != null && timeToWait.time > now) {
            res.status(UNAUTHORIZED).json({
              error: "task has not been validated, check back after 1 hr",
            });
            return;
          }

          while (!repostDone) {
            const {
              data: { users, has_next_page, next_cursor },
            } = await axios.get(
              `${API_URL}/tweet/retweeters?tweetId=${postId}&cursor=${repostCursor}`,
              {
                headers: {
                  "X-API-Key": `${THIRD_PARTY_API_KEY}`,
                },
              },
            );

            if (repostersArr.length >= 500 || users.length === 0) {
              repostDone = true;
              await REDIS.set({ key: repostKey, data: repostersArr });
            } else {
              repostersArr.push(...users);
              repostCursor = next_cursor;
              if (!has_next_page) {
                repostDone = true;
                await REDIS.set({ key: repostKey, data: repostersArr });
              }
            }
          }

          if (!timeToWait) {
            await timer.create({ time: "" });
          } else {
            timeToWait.time = new Date(now.getTime() + 1 * 60 * 60 * 1000);
            await timeToWait.save();
          }
        }

        repostDone = false;
        repostCursor = "";

        const hasReposted = repostersArr.some(
          (reposter: { id: string }) => reposter.id === xId,
        );

        if (!hasReposted) {
          res.status(BAD_REQUEST).json({ error: "tweet not reposted" });
          return;
        }

        res.status(OK).json({ message: "task verified", success: true });

        return;
      case "comment":
        const commentsArr = [];
        let commentDone = false;
        let commentCursor = "";

        const commentKey = `${postId}:comments`;

        const commentsInCache = (await REDIS.get(commentKey)) as any;

        const commentFound = commentsInCache.some(
          (reply: { author: { id: string } }) => reply.author.id === xId,
        );
        if (commentFound) {
          res.status(OK).json({ message: "task verified", success: true });
          return;
        }

        if (commentsInCache.length < 500) {
          const now = new Date();

          if (timeToWait?.time != null && timeToWait.time > now) {
            res.status(UNAUTHORIZED).json({
              error: "task has not been validated, check back after 1 hr",
            });
            return;
          }

          while (!commentDone) {
            const {
              data: { tweets, has_next_page, next_cursor },
            } = await axios.get(
              `${API_URL}/tweet/replies?tweetId=${postId}&cursor=${commentCursor}`,
              {
                headers: {
                  "X-API-Key": `${THIRD_PARTY_API_KEY}`,
                },
              },
            );

            if (commentsArr.length >= 500 || tweets.length === 0) {
              commentDone = true;
              await REDIS.set({ key: commentKey, data: commentsArr });
            } else {
              commentsArr.push(...tweets);
              commentCursor = next_cursor;
              if (!has_next_page) {
                commentDone = true;
                await REDIS.set({ key: commentKey, data: commentsArr });
              }
            }
          }

          if (!timeToWait) {
            await timer.create({ time: "" });
          } else {
            timeToWait.time = new Date(now.getTime() + 1 * 60 * 60 * 1000);
            await timeToWait.save();
          }
        }

        commentDone = false;
        commentCursor = "";

        const hasReplied = commentsArr.some(
          (reply: { author: { id: string } }) => reply.author.id === xId,
        );

        if (!hasReplied) {
          res
            .status(BAD_REQUEST)
            .json({ error: "tweet not commented on/task retry again" });
          return;
        }

        res.status(OK).json({ message: "task verified", success: true });
        return;
      default:
        res.status(BAD_REQUEST).json({ error: "invalid task tag" });
        return;
    }
  } catch (error: any) {
    logger.error(error);
    if (error?.status === 429) {
      res.status(429).json({
        error:
          "Oops, not fast enough. Rate limited by X API, try again after 16 mins",
      });
      return;
    }
    console.error({ error });
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error checking twitter task" });
  }
};

export const updateX = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { id } = req;
    const { x_id, username } = req.query as { x_id: string; username: string };

    if (!x_id || !username) {
      res
        .status(BAD_REQUEST)
        .json({ error: "authorization was not successful" });
      return;
    }

    const userToUpdate = await user.findById(id);
    if (!userToUpdate) {
      res.status(BAD_REQUEST).json({ error: "invalid user id" });
      return;
    }

    const now = new Date();

    const xAlreadyUsed = await user.findOne({ "socialProfiles.x.id": x_id });
    if (xAlreadyUsed && xAlreadyUsed._id !== userToUpdate._id) {
      if (xAlreadyUsed.socialProfiles?.x?.connected) {
        res
          .status(BAD_REQUEST)
          .json({ error: "x account already connected to another user" });
        return;
      }

      const disconnectedAt = xAlreadyUsed.socialProfiles?.x?.disconnectedAt;
      if (disconnectedAt) {
        if (now < disconnectedAt) {
          res.status(BAD_REQUEST).json({
            error:
              "x account disconnected recently, try again after 3 days. Try connecting another account",
          });
          return;
        }
      }

      const userToken = await token.findOne({ userId: x_id });
      if (!userToken) {
        res.status(BAD_REQUEST).json({
          error:
            "no access token or refresh token found, please connect x again",
        });
        return;
      }

      xAlreadyUsed!.socialProfiles!.x = {
        connected: false,
        id: "",
        username: "",
      };

      userToUpdate!.socialProfiles!.x = { connected: true, id: x_id, username };

      await userToUpdate.save();
      await xAlreadyUsed.save();

      res.status(OK).json({ message: "connected!", user: userToUpdate });
      return;
    }

    const userToken = await token.findOne({ userId: x_id });
    if (!userToken) {
      res.status(BAD_REQUEST).json({
        error: "no access token or refresh token found, please connect x again",
      });
      return;
    }

    userToUpdate.socialProfiles ??= {};

    userToUpdate.socialProfiles.x = { connected: true, id: x_id, username };

    await userToUpdate.save();

    res.status(OK).json({ message: "connected!", user: userToUpdate });
  } catch (error) {
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error saving connected state" });
  }
};

export const updateDiscord = async (
  req: GlobalRequest,
  res: GlobalResponse,
) => {
  try {
    const { id } = req;
    const { discord_id, username } = req.query as {
      discord_id: string;
      username: string;
    };

    if (!discord_id || !username) {
      res
        .status(BAD_REQUEST)
        .json({ error: "authorization was not successful" });
      return;
    }

    const userToUpdate = await user.findById(id);
    if (!userToUpdate) {
      res.status(BAD_REQUEST).json({ error: "invalid user id" });
      return;
    }

    const now = new Date();

    const discordAlreadyUsed = await user.findOne({
      "socialProfiles.discord.id": discord_id,
    });
    if (discordAlreadyUsed && discordAlreadyUsed._id !== userToUpdate._id) {
      if (discordAlreadyUsed.socialProfiles?.discord?.connected) {
        res
          .status(BAD_REQUEST)
          .json({ error: "discord account already connected to another user" });
        return;
      }

      const disconnectedAt =
        discordAlreadyUsed.socialProfiles?.discord?.disconnectedAt;
      if (disconnectedAt) {
        if (now < disconnectedAt) {
          res.status(BAD_REQUEST).json({
            error:
              "discord account disconnected recently, try again after 3 days. Try connecting another account",
          });
          return;
        }
      }

      discordAlreadyUsed!.socialProfiles!.discord = {
        connected: false,
        id: "",
        username: "",
      };

      userToUpdate!.socialProfiles!.discord = {
        connected: true,
        id: discord_id,
        username,
      };

      await userToUpdate.save();
      await discordAlreadyUsed.save();

      res.status(OK).json({ message: "connected!", user: userToUpdate });
      return;
    }

    userToUpdate.socialProfiles ??= {};

    userToUpdate.socialProfiles.discord = {
      connected: true,
      id: discord_id,
      username,
    };

    await userToUpdate.save();

    res.status(OK).json({ message: "connected!", user: userToUpdate });
  } catch (error) {
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error saving connected state" });
  }
};

export const saveCv = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { codeVerifier, state } = req.query as {
      codeVerifier: string;
      state: string;
    };
    if (!codeVerifier || !state) {
      res
        .status(BAD_REQUEST)
        .json({ error: "code verifier and state is required" });
      return;
    }

    await cvModel.create({ cv: codeVerifier, state });

    res.status(OK).json({ message: "saved" });
  } catch (error) {
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error saving code verifier" });
  }
};

export const checkDiscordTask = async (
  req: GlobalRequest,
  res: GlobalResponse,
) => {
  try {
    const {
      guildId: guildIdFromBody,
      tag: tagFromBody,
      campaignId: campaignIdFromBody,
      channelId: channelIdFromBody,
      roleId: roleIdFromBody,
    } = req.body;
    const id =
      (req.query.id as string) ||
      (req.body.id as string) ||
      (req.body.questId as string);
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "Quest ID is required" });
      return;
    }

    const userToCheck = await user.findById(req.id);
    if (!userToCheck) {
      res
        .status(BAD_REQUEST)
        .json({ error: "id associated with user is invalid" });
      return;
    }

    const discordId = userToCheck.socialProfiles?.discord?.id;

    if (!discordId) {
      res.status(UNAUTHORIZED).json({ error: "connect discord to proceed" });
      return;
    }

    // The same handler serves both campaign quests and main-app mini-quests.
    // The id posted by the client can belong to either collection, so look
    // both up and pick whichever matches. Mirrors the dual-lookup pattern
    // already used by validateTrustNameTask above.
    const campaignQuestData = await campaignQuest.findById(id).lean();
    const miniQuestData = !campaignQuestData
      ? await miniQuest.findById(id).lean()
      : null;

    if (!campaignQuestData && !miniQuestData) {
      res.status(NOT_FOUND).json({ error: "task not found" });
      return;
    }

    const isCampaign = !!campaignQuestData;

    if (
      isCampaign &&
      campaignIdFromBody &&
      campaignQuestData!.campaign?.toString() &&
      campaignQuestData!.campaign?.toString() !== String(campaignIdFromBody)
    ) {
      res.status(BAD_REQUEST).json({
        error: "campaign quest does not belong to the provided campaign",
      });
      return;
    }

    const resolvedParentId = String(
      isCampaign
        ? campaignIdFromBody || campaignQuestData!.campaign?.toString() || ""
        : (req.body.questId as string | undefined) ||
          miniQuestData!.quest?.toString() ||
          "",
    ).trim();

    if (!resolvedParentId) {
      res.status(BAD_REQUEST).json({
        error: isCampaign
          ? "campaign id is required for discord verification"
          : "quest id is required for discord verification",
      });
      return;
    }

    const CompletedModel = isCampaign
      ? (campaignQuestCompleted as any)
      : (miniQuestCompleted as any);
    const completedFilter = isCampaign
      ? { user: req.id, campaignQuest: id, campaign: resolvedParentId }
      : { user: req.id, miniQuest: id, quest: resolvedParentId };

    let completed: any = await CompletedModel.findOne(completedFilter);

    // Daily quests reset each UTC day: a stale prior-day completion must not
    // block today's re-verify. Time source is server-only (startOfDayUTC()).
    // Mirrors startQuest's daily-reset so the verify button stays usable on a
    // new day even when Start was never clicked explicitly.
    if (completed && !isCampaign) {
      const parentQuest = await quest.findById(resolvedParentId).lean();
      if (parentQuest?.category === "daily") {
        const isStaleDaily =
          !completed.updatedAt ||
          new Date(completed.updatedAt) < startOfDayUTC();
        if (isStaleDaily) {
          await CompletedModel.deleteOne({ _id: completed._id });
          completed = null;
        }
      }
    }

    if (completed?.done) {
      res
        .status(BAD_REQUEST)
        .json({ error: "user has already completed the task" });
      return;
    }

    const setDiscordTaskStatus = async (status: "pending" | "retry" | "approved") => {
      if (!completed) {
        completed = await CompletedModel.create({
          ...completedFilter,
          status,
        });
        return;
      }

      completed.status = status;
      await completed.save();
    };

    const failDiscordTask = async (
      errorMessage: string,
      statusCode: number = BAD_REQUEST,
    ) => {
      await setDiscordTaskStatus("retry");
      res.status(statusCode).json({ error: errorMessage });
    };

    const passDiscordTask = async (message = "validated") => {
      await setDiscordTaskStatus(isCampaign ? "pending" : "approved");
      // Main-app quest path: claim-mini-quest requires the overall quest-
      // completion record to exist (otherwise claimQuest fails). Mirror
      // what validateTrustNameTask does for non-campaign tasks.
      if (!isCampaign && req.id) {
        await ensureQuestStarted(resolvedParentId, req.id);
      }
      res.status(OK).json({ message, success: true });
    };

    const sourceDoc = (campaignQuestData ?? miniQuestData) as any;

    // Verify uses the build-time Discord IDs from the persisted quest document,
    // not whatever the client posts in the request body. A malicious / stale
    // client cannot reroute the verify to a different channel or role if the
    // studio's task editor set them at build time. Body fields are still used
    // above purely for guild-mismatch diagnostics against the project's active
    // Studio Discord connection. Time-based gating is server-only (Mongoose
    // timestamps + startOfDayUTC()).
    const resolvedTag = String(sourceDoc.tag ?? "")
      .trim()
      .toLowerCase();
    const resolvedGuildId = String(sourceDoc.guildId ?? "").trim();
    const resolvedRoleId = String(sourceDoc.roleId ?? "").trim();
    const resolvedChannelId = String(sourceDoc.channelId ?? "").trim();

    if (!BOT_TOKEN) {
      await failDiscordTask(
        "discord task verification is currently unavailable. Please try again shortly.",
        INTERNAL_SERVER_ERROR,
      );
      return;
    }

    // Find the project's hub via the correct parent collection: campaign
    // quests → campaign → .hub; mini quests → quest → .hub. The downstream
    // studioHub check then behaves identically in both paths.
    let studioHub: any;
    if (isCampaign) {
      const relatedCampaign = await campaign
        .findById(resolvedParentId)
        .select("hub")
        .lean();
      if (!relatedCampaign?.hub) {
        await failDiscordTask(
          "campaign project not found for this discord task",
          NOT_FOUND,
        );
        return;
      }
      studioHub = await hub
        .findById(relatedCampaign.hub)
        .select("discordConnected guildId verifiedId")
        .lean();
    } else {
      const relatedQuest = await quest
        .findById(resolvedParentId)
        .select("hub")
        .lean();
      if (!relatedQuest?.hub) {
        await failDiscordTask(
          "quest project not found for this discord task",
          NOT_FOUND,
        );
        return;
      }
      studioHub = await hub
        .findById(relatedQuest.hub)
        .select("discordConnected guildId verifiedId")
        .lean();
    }
    const studioGuildId = String(studioHub?.guildId ?? "").trim();
    const verifiedRoleId = String(studioHub?.verifiedId ?? "").trim();

    if (!studioHub?.discordConnected || !studioGuildId) {
      await failDiscordTask(
        "this project's Discord connection is not active in Studio. The campaign team needs to reconnect Discord before Discord tasks can be completed.",
        FORBIDDEN,
      );
      return;
    }

    if (resolvedGuildId && studioGuildId !== resolvedGuildId) {
      await failDiscordTask(
        "this campaign's Discord setup no longer matches the project's active Studio Discord connection. Please contact the campaign team.",
        FORBIDDEN,
      );
      return;
    }

    const fetchGuildMember = async () => {
      if (!resolvedGuildId) return null;
      try {
        const { data } = await axios.get(
          `https://discord.com/api/v10/guilds/${resolvedGuildId}/members/${discordId}`,
          {
            headers: {
              Authorization: `Bot ${BOT_TOKEN}`,
            },
          },
        );
        return data;
      } catch (error: any) {
        if (error?.response?.status === 404) return null;
        throw error;
      }
    };

    switch (resolvedTag) {
      case "join":
      case "join-discord": {
        if (!resolvedGuildId) {
          await failDiscordTask(
            "discord server is missing for this quest. Please contact the campaign team.",
          );
          return;
        }

        if (!verifiedRoleId) {
          await failDiscordTask(
            "this discord server has no verified role configured yet",
          );
          return;
        }

        let member: any;
        try {
          member = await fetchGuildMember();
        } catch (error) {
          logger.error(error);
          await failDiscordTask(
            "could not verify discord membership right now. Please try again.",
          );
          return;
        }

        if (!member) {
          await failDiscordTask("join the discord server and get verified");
          return;
        }

        const memberRoles: string[] = Array.isArray(member.roles)
          ? member.roles
          : [];
        if (!memberRoles.includes(verifiedRoleId)) {
          await failDiscordTask("you need to be verified to continue");
          return;
        }

        await passDiscordTask("validated");
        return;
      }
      case "acquire-role-discord": {
        if (!resolvedGuildId) {
          await failDiscordTask(
            "discord server is missing for this quest. Please contact the campaign team.",
          );
          return;
        }
        if (!resolvedRoleId) {
          await failDiscordTask(
            "this quest is missing a discord role to verify",
          );
          return;
        }

        let member: any;
        try {
          member = await fetchGuildMember();
        } catch (error) {
          logger.error(error);
          await failDiscordTask(
            "could not verify discord role right now. Please try again.",
          );
          return;
        }

        if (!member) {
          await failDiscordTask(
            "join the discord server before trying this task",
          );
          return;
        }

        const memberRoles: string[] = Array.isArray(member.roles)
          ? member.roles
          : [];
        if (!memberRoles.includes(resolvedRoleId)) {
          await failDiscordTask(
            "acquire the required discord role and try again",
          );
          return;
        }

        await passDiscordTask("validated");
        return;
      }
      case "message":
      case "message-discord":
      case "send-message-discord": {
        if (!resolvedChannelId) {
          await failDiscordTask(
            "this quest is missing a discord channel to verify",
          );
          return;
        }

        let hasSentMessage = false;
        let canUseChannelHistory = true;
        let beforeMessageId: string | undefined = undefined;

        try {
          for (let page = 0; page < 10; page++) {
            const channelResponse = await axios.get<any[]>(
              `https://discord.com/api/v10/channels/${resolvedChannelId}/messages`,
              {
                params: {
                  limit: 100,
                  ...(beforeMessageId ? { before: beforeMessageId } : {}),
                },
                headers: {
                  Authorization: `Bot ${BOT_TOKEN}`,
                },
              },
            );

            const channelMessages: any[] = Array.isArray(channelResponse.data)
              ? channelResponse.data
              : [];
            if (
              channelMessages.some(
                (messageDoc: any) =>
                  String(messageDoc?.author?.id ?? "") === String(discordId),
              )
            ) {
              hasSentMessage = true;
              break;
            }

            if (channelMessages.length < 100) break;

            const oldestMessageId: string | undefined =
              channelMessages[channelMessages.length - 1]?.id;
            if (!oldestMessageId) break;
            beforeMessageId = oldestMessageId;
          }
        } catch (error) {
          logger.error(error);
          canUseChannelHistory = false;
        }

        if (!hasSentMessage && !canUseChannelHistory) {
          const fallbackQueries: Record<string, string>[] = [];
          if (resolvedGuildId && resolvedChannelId)
            fallbackQueries.push({
              user_id: discordId,
              guild_id: resolvedGuildId,
              channel_id: resolvedChannelId,
            });
          if (resolvedGuildId)
            fallbackQueries.push({
              user_id: discordId,
              guild_id: resolvedGuildId,
            });

          for (const query of fallbackQueries) {
            const sentMessage = await firstMessage.findOne(query).lean();
            if (sentMessage) {
              hasSentMessage = true;
              break;
            }
          }
        }

        if (!hasSentMessage) {
          await failDiscordTask(
            "send a message in the selected discord channel to continue",
          );
          return;
        }

        await passDiscordTask("user has sent message");
        return;
      }
      default:
        res.status(BAD_REQUEST).json({ error: "invalid discord task tag" });
        return;
    }
  } catch (error) {
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error checking discord task" });
  }
};
