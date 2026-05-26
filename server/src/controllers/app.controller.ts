import logger from "@/config/logger";
import { cvModel } from "@/models/cv.models";
import { firstMessage } from "@/models/msg.model";
import { referredUsers } from "@/models/referrer.model";
import { token } from "@/models/tokens.model";
import { campaignQuest, miniQuest, quest } from "@/models/quests.model";
import { user } from "@/models/user.model";
import { hub } from "@/models/hub.model";
import { TNSProvider } from "@samoris/tns-sdk";
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
import { GRAPHQL_API_URL } from "@/utils/constants";
import { GraphQLClient } from "graphql-request";
import { checksumAddress } from "viem";
import { campaign, campaignCompleted } from "@/models/campaign.model";
import { dailySignIn } from "@/models/dailySignIn.model";
import { startOfDayUTC, updateLevel, getAmountPaid } from "@/utils/utils";
import { lesson, lessonCompleted } from "@/models/lesson.model";
import { xpLog } from "@/models/xpLog.model";

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
    amount: "60",
    authorizedAddress: serverWalletAddress,
  });
};

const getTrustNameProvider = () => {
  let provider: TNSProvider | null = null;

  if (!provider) {
    provider = new TNSProvider();
  }

  return provider;
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

    if (!taskExists) {
      await Model.create({
        ...filter,
        done: true,
        status: "done",
      });
    } else {
      taskExists.done = true;
      taskExists.status = "done";

      await taskExists.save();
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
    res.status(OK).json({ error: "error adding claim xp" });
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

    const filter = JSON.parse(req.query.filter as string) ?? {
      total_market_cap: "desc",
    };

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

    // set shares to be from 0.01
    const query = `
      query GetTriple($id: String!, $address: String!) {
        triple(term_id: $id) {
          positions (where:  {
            account_id:  {
              _eq: $address
            }
            shares:  {
              _gte: 10000000000000000
            }
          }) {
            account_id
          }

          counter_positions (where:  {
            account_id:  {
              _eq: $address
            }
            shares:  {
              _gte: 10000000000000000
            }
          }) {
            account_id
          }
        }
      }
    `; // user needs to atleast support or oppose with 0.5 - 1 trust;

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
            done: true,
            status: "done",
            user: userToCheck._id,
          });

          res.status(OK).json({ message: "task completed" });
          return;
        }
      } else {
        if (!supportFound && !opposeFound) {
          miniQuestExists.done = false;
          miniQuestExists.status = "retry";

          await miniQuestExists!.save();
        } else {
          miniQuestExists!.done = true;
          miniQuestExists!.status = "done";

          await miniQuestExists.save();

          res.status(OK).json({ message: "task completed" });
          return;
        }
      }

      res.status(BAD_REQUEST).json({
        error:
          "User has not supported or opposed a claim or shares is less than 0.01",
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
          "User has not supported or opposed a claim or shares is less than 0.01",
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
        {
          status: { $eq: "Active" },
        },
      ],
    });

    const totalQuests = await quest.countDocuments({ category: "weekly" });

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

    const totalQuestsCompleted = await questCompleted.countDocuments({
      done: true,
    });

    const totalCampaignsCompletedFound = await campaignCompleted
      .find()
      .select("campaignCompleted questsCompleted")
      .lean();

    const totalCampaignsCompleted = totalCampaignsCompletedFound.filter(
      (c) => c.campaignCompleted === true,
    ).length;

    const totalLessonJoined = await lessonCompleted.countDocuments();

    const lessonsCreated = await lesson.countDocuments();

    const totalLessonCompleted = await lessonCompleted.countDocuments({
      done: true,
    });

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

    const activeUsersWeekly = usersFound.filter(
      (u: { updatedAt: Date; status: string }) => {
        const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        return u.status === "Active" && u.updatedAt >= last7Days;
      },
    ).length;

    const activeUsersMonthly = usersFound.filter(
      (u: { updatedAt: Date; status: string }) => {
        const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        return u.status === "Active" && u.updatedAt >= last30Days;
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
        return (
          u.status === "Active" &&
          u.updatedAt >= prev7dStart &&
          u.updatedAt < prev7dEnd
        );
      },
    ).length;
    const prevActiveMonthly = usersFound.filter(
      (u: { updatedAt: Date; status: string }) => {
        return (
          u.status === "Active" &&
          u.updatedAt >= prev30dStart &&
          u.updatedAt < prev30dEnd
        );
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

export const performDailySignIn = async (
  req: GlobalRequest,
  res: GlobalResponse,
) => {
  try {
    const userId = req.id;

    const today = startOfDayUTC();
    const yesterday = new Date(today);
    yesterday.setUTCDate(today.getUTCDate() - 1);

    const onlyDate = today.toISOString().split("T")[0] as string;
    const yesterdayDate = yesterday.toISOString().split("T")[0] as string;

    const userExists = await user.findById(userId);
    if (!userExists) {
      res.status(NOT_FOUND).json({ message: "User not found" });
      return;
    }

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

    const previousStreak =
      typeof userExists.streak === "number" ? userExists.streak : 0;

    if (lastSignIn === yesterdayDate) {
      userExists.streak = previousStreak + 1;
    } else {
      // First sign-in ever, OR a gap of 2+ days — reset to 1.
      userExists.streak = 1;
    }

    const dailyXpAmount = 20;

    userExists.xp += dailyXpAmount;
    userExists.lastSignInDate = onlyDate;

    if (userExists.streak > (userExists.longestStreak || 0)) {
      userExists.longestStreak = userExists.streak;
    }

    const level = await updateLevel(
      userExists.xp,
      userExists.badges,
      userExists._id.toString(),
    );
    userExists.level = level;

    await xpLog.create({
      address: userExists.address,
      username: userExists.username,
      amount: dailyXpAmount,
      status: "success",
      type: "daily-xp",
    });

    await userExists.save();

    // Best-effort secondary record kept for any external readers (analytics,
    // admin dashboards). Not authoritative — failures here don't affect the
    // user's response or streak.
    try {
      await dailySignIn.findOneAndUpdate(
        { user: req.id },
        { $set: { date: onlyDate, user: req.id } },
        { upsert: true, new: true },
      );
    } catch (syncErr) {
      logger.warn(
        `dailySignIn sync failed for user ${userId} (non-fatal): ${syncErr}`,
      );
    }

    res.json({ message: "Daily sign-in successful", done: true });
  } catch (error) {
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error claiming daily quest" });
  }
};

export const claimsCreated = async (
  req: GlobalRequest,
  res: GlobalResponse,
) => {
  try {
  } catch (error) {
    logger.error(error);
    res
      .status(INTERNAL_SERVER_ERROR)
      .json({ error: "error updating claims created" });
  }
};

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
      userPositionAddress: userToFetch?.address ?? "...",
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

    const questInCampaign = await campaignQuest.findById(id).lean();
    if (!questInCampaign) {
      res.status(NOT_FOUND).json({ error: "campaign quest not found" });
      return;
    }

    const questCampaignId = questInCampaign.campaign?.toString?.() ?? "";
    if (
      campaignIdFromBody &&
      questCampaignId &&
      questCampaignId !== String(campaignIdFromBody)
    ) {
      res.status(BAD_REQUEST).json({
        error: "campaign quest does not belong to the provided campaign",
      });
      return;
    }

    const campaignId = String(
      campaignIdFromBody ?? questCampaignId ?? "",
    ).trim();
    if (!campaignId) {
      res
        .status(BAD_REQUEST)
        .json({ error: "campaign id is required for discord verification" });
      return;
    }

    let completed = await campaignQuestCompleted.findOne({
      user: req.id,
      campaignQuest: id,
      campaign: campaignId,
    });
    if (completed?.done) {
      res
        .status(BAD_REQUEST)
        .json({ error: "user has already completed the task" });
      return;
    }

    const setDiscordTaskStatus = async (status: "pending" | "retry") => {
      if (!completed) {
        completed = await campaignQuestCompleted.create({
          user: req.id,
          status,
          campaign: campaignId,
          campaignQuest: id,
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
      await setDiscordTaskStatus("pending");
      res.status(OK).json({ message, success: true });
    };

    const resolvedTag = String(questInCampaign.tag ?? tagFromBody ?? "")
      .trim()
      .toLowerCase();
    const resolvedGuildId = String(
      questInCampaign.guildId ?? guildIdFromBody ?? "",
    ).trim();
    const resolvedRoleId = String(
      questInCampaign.roleId ?? roleIdFromBody ?? "",
    ).trim();
    const resolvedChannelId = String(
      questInCampaign.channelId ?? channelIdFromBody ?? "",
    ).trim();

    if (!BOT_TOKEN) {
      await failDiscordTask(
        "discord task verification is currently unavailable. Please try again shortly.",
        INTERNAL_SERVER_ERROR,
      );
      return;
    }

    const relatedCampaign = await campaign
      .findById(campaignId)
      .select("hub")
      .lean();
    if (!relatedCampaign?.hub) {
      await failDiscordTask(
        "campaign project not found for this discord task",
        NOT_FOUND,
      );
      return;
    }

    const studioHub = await hub
      .findById(relatedCampaign.hub)
      .select("discordConnected guildId verifiedId")
      .lean();
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
          fallbackQueries.push({ user_id: discordId });

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
