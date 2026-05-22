import logger from "@/config/logger";
import { lesson, lessonCompleted, miniLesson, question, questionCompleted, videoLesson } from "@/models/lesson.model";
import { user } from "@/models/user.model";
import { BAD_REQUEST, OK, NOT_FOUND, INTERNAL_SERVER_ERROR, CREATED, FORBIDDEN } from "@/utils/status.utils";
import { uploadImg } from "@/utils/img.utils";
import { validateCreateLesson, validateCreateQuestion } from "@/utils/utils";
import { consumePaymentHash } from "@/controllers/studioPayment.controller";
import { xpLog } from "@/models/xpLog.model";

const getUploadedLessonImage = async (
  req: GlobalRequest,
  fieldName: "coverImage" | "profileImage",
  folder: string,
) => {
  const files = req.files as Record<string, Array<{ buffer: Buffer; originalname?: string }>> | undefined;
  const uploadedFile = files?.[fieldName]?.[0];

  if (!uploadedFile?.buffer) {
    return undefined;
  }

  return uploadImg({
    file: uploadedFile.buffer,
    filename: uploadedFile.originalname || `${fieldName}.jpg`,
    folder,
    maxSize: 2 * 1024 ** 2,
  });
};

const getNextLessonContentOrder = async (lessonId: string) => {
  const [maxMiniLesson, maxQuestion, maxVideo] = await Promise.all([
    miniLesson.findOne({ lesson: lessonId }).sort({ order: -1 }).select("order").lean(),
    question.findOne({ lesson: lessonId }).sort({ order: -1 }).select("order").lean(),
    videoLesson.findOne({ lesson: lessonId }).sort({ order: -1 }).select("order").lean(),
  ]);

  const maxOrder = Math.max(
    Number(maxMiniLesson?.order ?? -1),
    Number(maxQuestion?.order ?? -1),
    Number(maxVideo?.order ?? -1),
  );

  return maxOrder + 1;
};

export const createLesson = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { title, description, reward, disclaimer, completionTrophy, completionTitle, completionMessage, section, section2Name } = req.body;

    if (!title?.trim() || !description?.trim() || reward == null) {
      res.status(BAD_REQUEST).json({ error: "title, description, and reward are required" });
      return;
    }

    const coverImage = await getUploadedLessonImage(req, "coverImage", "lesson-covers");
    const profileImage = await getUploadedLessonImage(req, "profileImage", "lesson-profiles");

    const hubId = req.admin?.hub;
    const isProjectHub = hubId && req.admin?.role; 
    const isUserHub = hubId && !req.admin?.role; 

    const creator = hubId || req.id;
    const creatorModel = isProjectHub ? "project" : (isUserHub ? "user-hubs" : (req.admin ? "admin" : "users"));
    const creatorName = req.admin?.name || req.user?.name || req.adminName || "User";

    logger.info(`[createLesson] Attempting to create lesson. creator: ${creator}, creatorModel: ${creatorModel}, creatorName: ${creatorName}`);
    logger.info(`[createLesson] Body: ${JSON.stringify(req.body)}`);

    let newLesson;
    try {
      newLesson = await lesson.create({
        title: String(title).trim(),
        description: String(description).trim(),
        reward: Number(reward),
        disclaimer: typeof disclaimer === "string" ? disclaimer.trim() : "",
        completionTrophy: completionTrophy || "",
        completionTitle: completionTitle || "",
        completionMessage: completionMessage || "",
        section: section ? Number(section) : 1,
        section2Name: typeof section2Name === "string" ? section2Name.trim() : "",
        coverImage: coverImage || "",
        profileImage: profileImage || "",
        status: "draft",
        creatorName,
        creator,
        creatorModel,
      });
    } catch (createErr: any) {
      logger.error(`[createLesson] Mongoose create failed: ${createErr.message}`);
      if (createErr.errors) {
        logger.error(`[createLesson] Validation Errors: ${JSON.stringify(createErr.errors)}`);
      }
      throw createErr;
    }

    res.status(CREATED).json({ message: "lesson created", lesson: newLesson });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error creating lesson" });
  }
};

export const updateLesson = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { lessonId, title, description, reward, disclaimer, completionTrophy, completionTitle, completionMessage, status, section, section2Name } = req.body as {
      lessonId?: string;
      title?: string;
      description?: string;
      reward?: number;
      disclaimer?: string;
      completionTrophy?: string;
      completionTitle?: string;
      completionMessage?: string;
      status?: "draft" | "published";
      section?: number;
      section2Name?: string;
    };

    if (!lessonId) {
      res.status(BAD_REQUEST).json({ error: "lessonId is required" });
      return;
    }

    const lessonExists = await lesson.findById(lessonId);
    if (!lessonExists) {
      res.status(NOT_FOUND).json({ error: "lesson does not exist" });
      return;
    }

    if (typeof title === "string" && title.trim()) {
      lessonExists.title = title.trim();
    }

    if (typeof description === "string" && description.trim()) {
      lessonExists.description = description.trim();
    }

    if (reward !== undefined) {
      const normalizedReward = Number(reward);
      if (!Number.isFinite(normalizedReward) || normalizedReward < 0) {
        res.status(BAD_REQUEST).json({ error: "reward must be a valid number" });
        return;
      }
      lessonExists.reward = normalizedReward;
    }

    if (typeof disclaimer === "string") {
      lessonExists.disclaimer = disclaimer.trim();
    }

    if (completionTrophy !== undefined) lessonExists.completionTrophy = completionTrophy;
    if (completionTitle !== undefined) lessonExists.completionTitle = completionTitle;
    if (completionMessage !== undefined) lessonExists.completionMessage = completionMessage;
    if (section !== undefined) lessonExists.section = Number(section);
    if (typeof section2Name === "string") lessonExists.section2Name = section2Name.trim();
    
    // Handle status field - allow updating to draft or published
    if (status === "draft" || status === "published") {
      lessonExists.status = status;
    }

    const coverImage = await getUploadedLessonImage(req, "coverImage", "lesson-covers");
    const profileImage = await getUploadedLessonImage(req, "profileImage", "lesson-profiles");

    if (coverImage) {
      lessonExists.coverImage = coverImage;
    }

    if (profileImage) {
      lessonExists.profileImage = profileImage;
    }

    await lessonExists.save();

    res.status(OK).json({ message: "lesson updated" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error updating lesson" });
  }
};

export const createQuestion = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { lesson: lessonId, question: questionText, options, solution, introHeader, introBody, introTrophy, outroHeader, outroBody, outroTrophy, section } = req.body;
    if (!lessonId || questionText === undefined || !Array.isArray(options) || solution === undefined) {
      res.status(BAD_REQUEST).json({ error: "Send the required values. Required values are: lesson id as 'lesson', question, options as array and solution" });
      return;
    }

    const nextOrder = await getNextLessonContentOrder(lessonId);

    const newQuestion = await question.create({
      lesson: lessonId,
      question: questionText,
      options,
      solution,
      introHeader: introHeader || "",
      introBody: introBody || "",
      introTrophy: introTrophy || "",
      outroHeader: outroHeader || "",
      outroBody: outroBody || "",
      outroTrophy: outroTrophy || "",
      section: section ? Number(section) : 1,
      order: nextOrder
    });

    await lesson.updateOne({ _id: lessonId }, { $inc: { noOfQuestions: 1 } });

    res.status(CREATED).json({ message: "question created", question: newQuestion });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error creating lesson question" });
  }
}

export const updateQuestion = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { questionId, question: questionText, options, solution, introHeader, introBody, introTrophy, outroHeader, outroBody, outroTrophy, section } = req.body as {
      questionId?: string;
      question?: string;
      options?: string[];
      solution?: string;
      introHeader?: string;
      introBody?: string;
      introTrophy?: string;
      outroHeader?: string;
      outroBody?: string;
      outroTrophy?: string;
      section?: number;
    };

    if (!questionId) {
      res.status(BAD_REQUEST).json({ error: "questionId is required" });
      return;
    }

    const questionExists = await question.findById(questionId);
    if (!questionExists) {
      res.status(NOT_FOUND).json({ error: "question does not exist" });
      return;
    }

    if (Array.isArray(options)) {
      const normalizedOptions = options.map((option) => option.trim()).filter(Boolean);
      if (normalizedOptions.length < 2) {
        res.status(BAD_REQUEST).json({ error: "at least two options are required" });
        return;
      }
      questionExists.options = normalizedOptions;

      if (solution !== undefined) {
        const normalizedSolution = String(solution).trim();
        if (!normalizedOptions.includes(normalizedSolution)) {
          res.status(BAD_REQUEST).json({ error: "solution must match one of the options" });
          return;
        }
        questionExists.solution = normalizedSolution;
      }
    }

    if (typeof questionText === "string" && questionText.trim()) {
      questionExists.question = questionText.trim();
    }

    if (typeof introHeader === "string") questionExists.introHeader = introHeader;
    if (typeof introBody === "string") questionExists.introBody = introBody;
    if (typeof introTrophy === "string") questionExists.introTrophy = introTrophy as "" | "bronze" | "silver" | "gold";
    if (typeof outroHeader === "string") questionExists.outroHeader = outroHeader;
    if (typeof outroBody === "string") questionExists.outroBody = outroBody;
    if (typeof outroTrophy === "string") questionExists.outroTrophy = outroTrophy as "" | "bronze" | "silver" | "gold";
    if (section !== undefined) questionExists.section = Number(section);

    await questionExists.save();

    res.status(OK).json({ message: "question updated" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error updating lesson question" });
  }
};

export const createMiniLesson = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { text, lesson: lessonId, introHeader, introBody, introTrophy, outroHeader, outroBody, outroTrophy, section } = req.body;
    if (text === undefined || text === null || !lessonId) {
      res.status(BAD_REQUEST).json({ error: "Send the required values. Required values are: lesson id as 'lesson' and text" });
      return;
    }

    const nextOrder = await getNextLessonContentOrder(lessonId);

    const newMiniLesson = await miniLesson.create({
      text,
      lesson: lessonId,
      introHeader: introHeader || "",
      introBody: introBody || "",
      introTrophy: introTrophy || "",
      outroHeader: outroHeader || "",
      outroBody: outroBody || "",
      outroTrophy: outroTrophy || "",
      section: section ? Number(section) : 1,
      order: nextOrder
    });

    res.status(CREATED).json({ message: "mini lesson created", miniLesson: newMiniLesson });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error creating mini lesson" });
  }
}

export const updateMiniLesson = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { miniLessonId, text, introHeader, introBody, introTrophy, outroHeader, outroBody, outroTrophy, section } = req.body as {
      miniLessonId?: string;
      text?: string;
      introHeader?: string;
      introBody?: string;
      introTrophy?: string;
      outroHeader?: string;
      outroBody?: string;
      outroTrophy?: string;
      section?: number;
    };
    if (!miniLessonId) {
      res.status(BAD_REQUEST).json({ error: "miniLessonId is required" });
      return;
    }

    const miniLessonExists = await miniLesson.findById(miniLessonId);
    if (!miniLessonExists) {
      res.status(NOT_FOUND).json({ error: "mini lesson does not exist" });
      return;
    }

    if (text !== undefined) miniLessonExists.text = String(text).trim();
    if (typeof introHeader === "string") miniLessonExists.introHeader = introHeader;
    if (typeof introBody === "string") miniLessonExists.introBody = introBody;
    if (typeof introTrophy === "string") miniLessonExists.introTrophy = introTrophy as "" | "bronze" | "silver" | "gold";
    if (typeof outroHeader === "string") miniLessonExists.outroHeader = outroHeader;
    if (typeof outroBody === "string") miniLessonExists.outroBody = outroBody;
    if (typeof outroTrophy === "string") miniLessonExists.outroTrophy = outroTrophy as "" | "bronze" | "silver" | "gold";
    if (section !== undefined) miniLessonExists.section = Number(section);
    await miniLessonExists.save();

    res.status(OK).json({ message: "mini lesson updated" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error updating mini lesson" });
  }
};

export const createVideoLesson = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { url, lesson: lessonId, introHeader, introBody, introTrophy, outroHeader, outroBody, outroTrophy, section } = req.body;
    if (url === undefined || url === null || !lessonId) {
      res.status(BAD_REQUEST).json({ error: "Send the required values. Required values are: lesson id as 'lesson' and url" });
      return;
    }

    const nextOrder = await getNextLessonContentOrder(lessonId);

    const newVideoLesson = await videoLesson.create({
      url,
      lesson: lessonId,
      introHeader: introHeader || "",
      introBody: introBody || "",
      introTrophy: introTrophy || "",
      outroHeader: outroHeader || "",
      outroBody: outroBody || "",
      outroTrophy: outroTrophy || "",
      section: section ? Number(section) : 1,
      order: nextOrder
    });

    res.status(CREATED).json({ message: "video lesson created", videoLesson: newVideoLesson });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error creating video lesson" });
  }
};

export const updateVideoLesson = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { videoLessonId, url, introHeader, introBody, introTrophy, outroHeader, outroBody, outroTrophy, section } = req.body as {
      videoLessonId?: string;
      url?: string;
      introHeader?: string;
      introBody?: string;
      introTrophy?: string;
      outroHeader?: string;
      outroBody?: string;
      outroTrophy?: string;
      section?: number;
    };
    if (!videoLessonId) {
      res.status(BAD_REQUEST).json({ error: "videoLessonId is required" });
      return;
    }

    const videoLessonExists = await videoLesson.findById(videoLessonId);
    if (!videoLessonExists) {
      res.status(NOT_FOUND).json({ error: "video lesson does not exist" });
      return;
    }

    if (url !== undefined) videoLessonExists.url = String(url).trim();
    if (typeof introHeader === "string") videoLessonExists.introHeader = introHeader;
    if (typeof introBody === "string") videoLessonExists.introBody = introBody;
    if (typeof introTrophy === "string") videoLessonExists.introTrophy = introTrophy as "" | "bronze" | "silver" | "gold";
    if (typeof outroHeader === "string") videoLessonExists.outroHeader = outroHeader;
    if (typeof outroBody === "string") videoLessonExists.outroBody = outroBody;
    if (typeof outroTrophy === "string") videoLessonExists.outroTrophy = outroTrophy as "" | "bronze" | "silver" | "gold";
    if (section !== undefined) videoLessonExists.section = Number(section);
    await videoLessonExists.save();

    res.status(OK).json({ message: "video lesson updated" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error updating video lesson" });
  }
};

export const deleteVideoLesson = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { id: videoLessonId } = req.query as { id: string };
    if (!videoLessonId) {
      res.status(BAD_REQUEST).json({ error: "video lesson id is required" });
      return;
    }
    await videoLesson.deleteOne({ _id: videoLessonId });
    res.status(OK).json({ message: "video lesson deleted" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error deleting video lesson" });
  }
};

export const rewardLessonXp = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { id: lessonId } = req.query as { id: string };
    const { id } = req;

    const lessonExists = await lesson.findById(lessonId).lean().select("reward");
    if (!lessonExists) {
      res.status(NOT_FOUND).json({ error: "lesson does not exist" });
      return;
    }

    const existingLessonProgress = await lessonCompleted.findOne({ lesson: lessonId, user: id });
    if (!existingLessonProgress) {
      res.status(BAD_REQUEST).json({ error: "lesson has not been started" });
      return;
    }

    if (existingLessonProgress.done) {
      res.status(BAD_REQUEST).json({ error: "xp has already been claimed for this lesson" });
      return;
    }

    const [totalQuestions, questionsAnswered] = await Promise.all([
      question.countDocuments({ lesson: lessonId }),
      questionCompleted.countDocuments({ done: true, user: id, lesson: lessonId }),
    ]);
    if (totalQuestions > 0 && questionsAnswered < totalQuestions) {
      res.status(FORBIDDEN).json({ error: "answer all questions before reward can be claimed" });
      return;
    }

    const rewardAmount = Number(lessonExists.reward || 0);

    existingLessonProgress.status = "completed";
    existingLessonProgress.done = true;

    await xpLog.create({
      address: req.user.address,
			username: req.user.username,
			amount: rewardAmount,
			status: "success",
			type: "lesson"
    });

    await user.updateOne({ _id: id }, { $inc: { xp: rewardAmount, lessonsCompleted: 1 } });
    await existingLessonProgress.save();
    res.status(OK).json({ message: "xp reward claimed", reward: rewardAmount });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error rewarding lesson xp" });
  }
}

export const getLessons = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const lessons = await lesson.find({ status: "published" })
      .sort({ createdAt: 1 })
      .populate('creator', 'name logo')
      .lean();
    const lessonsCompleted = await lessonCompleted.find({ user: req.id }).lean();

    const Hub = (await import('../models/hub.model')).hub;

    const mergedLessons: any[] = [];

    for (const singleLesson of lessons) {
      const singleLessonCompleted = lessonsCompleted.find(
        (completedSingleLesson) =>
          completedSingleLesson.lesson?.toString() === singleLesson._id.toString()
      );

      const mergedSingleLesson: Record<any, unknown> = singleLesson;

      mergedSingleLesson.done = singleLessonCompleted ? singleLessonCompleted.done : false;

      // Set creatorName and profileImage based on creatorModel
      if (singleLesson.creatorModel === 'user-hubs' && singleLesson.creator) {
        const hub = await Hub.findById(singleLesson.creator).select('name logo systemKey').lean();
        if (hub) {
          mergedSingleLesson.creatorName = hub.name;
          mergedSingleLesson.profileImage = hub.logo;
        }
      } else if (singleLesson.creatorModel === 'admin' && singleLesson.creator) {
        // Check if it's a system hub (Nexura)
        const hub = await Hub.findById(singleLesson.creator).select('name logo systemKey').lean();
        if (hub?.systemKey === 'nexura-admin-campaigns') {
          mergedSingleLesson.creatorName = 'Nexura';
          mergedSingleLesson.profileImage = hub.logo;
        } else if (hub) {
          mergedSingleLesson.creatorName = hub.name;
          mergedSingleLesson.profileImage = hub.logo;
        }
      }

      mergedLessons.push(mergedSingleLesson);
    }

    res.status(OK).json({ message: "lessons fetched!", lessons: mergedLessons });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error getting lesson" });
  }
};

export const getAllLessons = async (_req: GlobalRequest, res: GlobalResponse) => {
  try {
    logger.info("[getAllLessons] Fetching all lessons");
    const lessons = await lesson.find().sort({ createdAt: 1 }).lean();
    logger.info(`[getAllLessons] Found ${lessons.length} lessons`);
    res.status(OK).json({ message: "lessons fetched!", lessons });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error getting lessons" });
  }
};

export const getAdminLessons = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    logger.info("[getAdminLessons] Fetching admin-created lessons");
    // Match lessons with creatorModel "admin" OR created directly by this admin
    const lessons = await lesson
      .find({
        $or: [
          { creatorModel: "admin" },
          { creator: req.id },
        ],
      })
      .sort({ createdAt: -1 })
      .lean();

    // Attach real content counts
    const lessonIds = lessons.map((l) => l._id);
    if (lessonIds.length > 0) {
      const [miniCounts, questionCounts, videoCounts] = await Promise.all([
        miniLesson.aggregate([
          { $match: { lesson: { $in: lessonIds } } },
          { $group: { _id: "$lesson", count: { $sum: 1 } } },
        ]),
        question.aggregate([
          { $match: { lesson: { $in: lessonIds } } },
          { $group: { _id: "$lesson", count: { $sum: 1 } } },
        ]),
        videoLesson.aggregate([
          { $match: { lesson: { $in: lessonIds } } },
          { $group: { _id: "$lesson", count: { $sum: 1 } } },
        ]),
      ]);
      const countMap = new Map<string, { mini: number; question: number; video: number }>();
      for (const l of lessons) {
        countMap.set(String(l._id), { mini: 0, question: 0, video: 0 });
      }
      for (const { _id, count } of miniCounts) countMap.get(String(_id))!.mini = count;
      for (const { _id, count } of questionCounts) countMap.get(String(_id))!.question = count;
      for (const { _id, count } of videoCounts) countMap.get(String(_id))!.video = count;
      for (const l of lessons) {
        const counts = countMap.get(String(l._id))!;
        (l as any).miniLessonsCount = counts.mini;
        (l as any).questionsCount = counts.question;
        (l as any).videoLessonsCount = counts.video;
      }
    }

    logger.info(`[getAdminLessons] Found ${lessons.length} admin lessons`);
    res.status(OK).json({ message: "admin lessons fetched!", lessons });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error getting admin lessons" });
  }
};

export const getLessonById = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { lessonId } = req.query as { lessonId?: string };
    if (!lessonId) {
      res.status(BAD_REQUEST).json({ error: "lessonId is required" });
      return;
    }
    const found = await lesson.findById(lessonId).lean();
    if (!found) {
      res.status(NOT_FOUND).json({ error: "Lesson not found" });
      return;
    }
    res.status(OK).json({ message: "lesson fetched!", lesson: found });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error getting lesson" });
  }
};

export const getHubLessons = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    if (!req.admin?.hub) {
      res.status(BAD_REQUEST).json({ error: "No hub found for admin" });
      return;
    }
    const lessons = await lesson.find({ creator: req.admin.hub }).sort({ createdAt: 1 }).lean();
    res.status(OK).json({ message: "lessons fetched!", lessons });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error getting lessons" });
  }
};

export const publishLesson = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { lessonId } = req.body as { lessonId?: string };
    if (!lessonId) {
      res.status(BAD_REQUEST).json({ error: "lessonId is required" });
      return;
    }
    const lessonExists = await lesson.findById(lessonId);
    if (!lessonExists) {
      res.status(NOT_FOUND).json({ error: "lesson does not exist" });
      return;
    }
    lessonExists.status = "published";
    await lessonExists.save();
    // Consume the one-time payment hash after publishing (if hub exists)
    if (req.admin?.hub) {
      await consumePaymentHash(req.admin.hub);
    }
    res.status(OK).json({ message: "lesson published" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error publishing lesson" });
  }
};

export const unpublishLesson = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { lessonId } = req.body as { lessonId?: string };
    if (!lessonId) {
      res.status(BAD_REQUEST).json({ error: "lessonId is required" });
      return;
    }
    const lessonExists = await lesson.findById(lessonId);
    if (!lessonExists) {
      res.status(NOT_FOUND).json({ error: "lesson does not exist" });
      return;
    }
    lessonExists.status = "draft";
    await lessonExists.save();
    res.status(OK).json({ message: "lesson saved as draft" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error saving lesson as draft" });
  }
};

export const updateQuestionIntro = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { questionId, introHeader, introBody, introTrophy } = req.body as {
      questionId?: string;
      introHeader?: string;
      introBody?: string;
      introTrophy?: string;
    };
    if (!questionId) {
      res.status(BAD_REQUEST).json({ error: "questionId is required" });
      return;
    }
    const questionExists = await question.findById(questionId);
    if (!questionExists) {
      res.status(NOT_FOUND).json({ error: "question does not exist" });
      return;
    }
    questionExists.introHeader = introHeader ?? "";
    questionExists.introBody = introBody ?? "";
    questionExists.introTrophy = (introTrophy ?? "") as "" | "bronze" | "silver" | "gold";
    await questionExists.save();
    res.status(OK).json({ message: "question intro updated" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error updating question intro" });
  }
};

export const getLessonDetailsForAdmin = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { id: lessonId } = req.query as { id: string };
    if (!lessonId) {
      res.status(BAD_REQUEST).json({ error: "lesson id is required" });
      return;
    }

    const lessonExists = await lesson.exists({ _id: lessonId });
    if (!lessonExists) {
      res.status(NOT_FOUND).json({ error: "lesson does not exist" });
      return;
    }

    const [miniLessons, questions, videoLessons, lessonDoc] = await Promise.all([
      miniLesson.find({ lesson: lessonId }).sort({ order: 1, createdAt: 1 }).lean(),
      question.find({ lesson: lessonId }).sort({ order: 1, createdAt: 1 }).lean(),
      videoLesson.find({ lesson: lessonId }).sort({ order: 1, createdAt: 1 }).lean(),
      lesson.findById(lessonId).select("section2Name").lean(),
    ]);

    res.status(OK).json({
      message: "lesson details fetched",
      miniLessons,
      questions,
      videoLessons,
      section2Name: (lessonDoc as any)?.section2Name || "",
    });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error getting lesson details" });
  }
};

export const getMiniLessonAndQuestions = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { id } = req;
    const { id: lessonId } = req.query as { id: string };
    if (!lessonId) {
      res.status(BAD_REQUEST).json({ error: "lesson id is required" });
      return;
    }

    const lessonDoc = await lesson.findById(lessonId).select("status section section2Name").lean();
    if (!lessonDoc || lessonDoc.status !== "published") {
      res.status(NOT_FOUND).json({ error: "lesson not found" });
      return;
    }

    const hasSection2 = lessonDoc.section === 2;

    const [miniLessons, questions, videoLessons] = await Promise.all([
      miniLesson.find({ lesson: lessonId }).sort({ order: 1, createdAt: 1 }).lean(),
      question.find({ lesson: lessonId }).select("options question lesson solution order createdAt introHeader introBody introTrophy outroHeader outroBody outroTrophy section").sort({ order: 1, createdAt: 1 }).lean(),
      videoLesson.find({ lesson: lessonId }).sort({ order: 1, createdAt: 1 }).lean(),
    ]);
    const questionsCompleted = id
      ? await questionCompleted.find({ user: id, lesson: lessonId }).lean()
      : [];

    const mergedLessonsQuestions: any = [];

    for (const singleQuestion of questions) {
      const singleQuestionCompleted = questionsCompleted.find(
        (completedSingleQuestion) =>
          completedSingleQuestion.question?.toString() === singleQuestion._id.toString()
      );

      const mergedSingleQuestion: Record<any, unknown> = singleQuestion;

      mergedSingleQuestion.done = singleQuestionCompleted ? singleQuestionCompleted.done : false;
      mergedSingleQuestion.answer = singleQuestionCompleted ? singleQuestionCompleted.answer : "";

      mergedLessonsQuestions.push(mergedSingleQuestion);
    }

    // Group by section for structured output
    const section1 = {
      miniLessons: miniLessons.filter((m: any) => (m.section || 1) === 1),
      questions: mergedLessonsQuestions.filter((q: any) => (q.section || 1) === 1),
      videoLessons: videoLessons.filter((v: any) => (v.section || 1) === 1),
    };
    const section2 = hasSection2 ? {
      name: lessonDoc.section2Name || "Section 2",
      miniLessons: miniLessons.filter((m: any) => m.section === 2),
      questions: mergedLessonsQuestions.filter((q: any) => q.section === 2),
      videoLessons: videoLessons.filter((v: any) => v.section === 2),
    } : null;

    res.status(OK).json({
      message: "mini lessons and questions fetched",
      miniLessons,
      questions: mergedLessonsQuestions,
      videoLessons,
      hasSection2,
      section1,
      section2,
    });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error getting mini lesson and questions" });
  }
}

export const answerQuestion = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
		const { id } = req;
    const { question: questionId, answer, lesson: lessonId } = req.body;

    const lowerAnswer = answer.toLowerCase();

    if (!questionId || !answer || !lessonId) {
			res.status(BAD_REQUEST).json({ error: "Send the required values. The values are question id as 'question', lesson id as 'lesson' and the answer" });
			return;
    }

    const questionExists = await question.findById(questionId);
    if (!questionExists) {
      res.status(NOT_FOUND).json({ error: "question id is invalid" });
      return;
    }

    const lowerSolution = (questionExists.solution || "").toLowerCase();

    const questionAlreadyAnswered = await questionCompleted.findOne({ question: questionId, lesson: lessonId, user: id });
    if (!questionAlreadyAnswered) {
      if (lowerAnswer !== lowerSolution) {
        await questionCompleted.create({ user: id, answer: lowerAnswer, lesson: lessonId, question: questionId });

        res.status(BAD_REQUEST).json({ error: "wrong answer" });
        return;
      }

      await questionCompleted.create({ done: true, answer: lowerAnswer, lesson: lessonId, user: id, question: questionId });

      res.status(OK).json({ message: "correct answer" });
      return;
    }

    if (questionAlreadyAnswered.done === true) {
      res.status(FORBIDDEN).json({ error: "question already answered" });
      return;
    }

    if (lowerAnswer !== lowerSolution) {
      if (lowerAnswer !== questionAlreadyAnswered.answer) {
        questionAlreadyAnswered.answer = lowerAnswer;

        await questionAlreadyAnswered.save(); 
      }

      res.status(BAD_REQUEST).json({ message: "wrong answer" });
      return;
    }

    questionAlreadyAnswered.answer = lowerAnswer;
    questionAlreadyAnswered.done = true;

    await questionAlreadyAnswered.save();

    res.status(OK).json({ message: "correct answer" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error answering question" });
  }
}

export const startLesson = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const id = req.id as string;
    const lessonId = req.query.lessonId as string;

    const lessonExists = await lesson.exists({ _id: lessonId });
    if (!lessonExists) {
      res.status(NOT_FOUND).json({ error: "lesson id in invalid" });
      return;
    }
    const lessonStarted = await lessonCompleted.exists({ user: id, lesson: lessonId });
    if (lessonStarted) {
      res.status(BAD_REQUEST).json({ error: "lesson already started or completed" });
      return;
    }

    await lessonCompleted.create({ lesson: lessonId, user: id });

    res.status(OK).json({ message: "lesson started!" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error starting lesson" });
  }
}

export const deleteLesson = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { id: lessonId } = req.query as { id: string };

    if (!lessonId) {
      res.status(BAD_REQUEST).json({ error: "lesson id is required" });
      return;
    }

    await Promise.all([
      lesson.deleteOne({ _id: lessonId }),
      miniLesson.deleteMany({ lesson: lessonId }),
      question.deleteMany({ lesson: lessonId }),
      videoLesson.deleteMany({ lesson: lessonId }),
      lessonCompleted.deleteMany({ lesson: lessonId }),
      questionCompleted.deleteMany({ lesson: lessonId }),
    ]);

    res.status(OK).json({ message: "lesson deleted" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error deleting lesson" });
  }
};

export const deleteMiniLesson = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { id: miniLessonId } = req.query as { id: string };
    if (!miniLessonId) {
      res.status(BAD_REQUEST).json({ error: "mini lesson id is required" });
      return;
    }
    await miniLesson.deleteOne({ _id: miniLessonId });
    res.status(OK).json({ message: "mini lesson deleted" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error deleting mini lesson" });
  }
};

export const deleteQuestion = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { id: questionId } = req.query as { id: string };
    if (!questionId) {
      res.status(BAD_REQUEST).json({ error: "question id is required" });
      return;
    }
    await Promise.all([
      question.deleteOne({ _id: questionId }),
      questionCompleted.deleteMany({ question: questionId }),
    ]);
    res.status(OK).json({ message: "question deleted" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error deleting question" });
  }
};

export const reorderLessonContent = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { lessonId, items } = req.body as {
      lessonId?: string;
      items?: Array<{ id: string; kind: "mini" | "question" | "video"; order: number }>;
    };

    if (!lessonId || !Array.isArray(items) || items.length === 0) {
      res.status(BAD_REQUEST).json({ error: "lessonId and items array are required" });
      return;
    }

    const lessonExists = await lesson.exists({ _id: lessonId });
    if (!lessonExists) {
      res.status(NOT_FOUND).json({ error: "lesson does not exist" });
      return;
    }

    await Promise.all(
      items.map((item) => {
        if (item.kind === "mini") {
          return miniLesson.updateOne({ _id: item.id, lesson: lessonId }, { $set: { order: item.order } });
        }
        if (item.kind === "video") {
          return videoLesson.updateOne({ _id: item.id, lesson: lessonId }, { $set: { order: item.order } });
        }
        return question.updateOne({ _id: item.id, lesson: lessonId }, { $set: { order: item.order } });
      })
    );

    res.status(OK).json({ message: "order updated" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error reordering lesson content" });
  }
};


