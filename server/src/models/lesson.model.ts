import mongoose from "mongoose";

const lessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  coverImage: {
    type: String,
    default: "",
  },
  profileImage: {
    type: String,
    default: "",
  },
  noOfQuestions: {
    type: Number,
    default: 0,
  },
  reward: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ["draft", "published"],
    default: "draft",
  },
  deletedAt: {
    type: Date,
    default: null,
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: "creatorModel",
    required: true
  },
  creatorModel: {
    type: String,
    required: true,
    enum: ["users", "project", "user-hubs", "admin"]
  },
  disclaimer: {
    type: String,
    default: "",
  },
  creatorName: {
    type: String,
    default: "",
  },
  completionTrophy: {
    type: String,
    default: "",
  },
  completionTitle: {
    type: String,
    default: "",
  },
  completionMessage: {
    type: String,
    default: "",
  },
  section: {
    type: Number,
    enum: [1, 2],
    default: 1,
  },
  section2Name: {
    type: String,
    default: "",
  },
  section2IntroBody: {
    type: String,
    default: "",
  }
}, { timestamps: true });

const lesson = mongoose.model("lessons", lessonSchema);

const lessonCompletedSchema = new mongoose.Schema({
  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "lessons",
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true
  },
  status: {
    type: String,
    enum: ["in-progress", "completed"],
    default: "in-progress"
  },
  done: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

const lessonCompleted = mongoose.model(
  "lessons-completed",
  lessonCompletedSchema
);


const miniLessonSchema = new mongoose.Schema({
  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "lessons",
    required: true
  },
  text: {
    type: String,
    required: false,
    default: "",
  },
  order: {
    type: Number,
    default: 0
  },
  introHeader: {
    type: String,
    default: "",
  },
  introBody: {
    type: String,
    default: "",
  },
  introTrophy: {
    type: String,
    enum: ["bronze", "silver", "gold", ""],
    default: "",
  },
  outroHeader: {
    type: String,
    default: "",
  },
  outroBody: {
    type: String,
    default: "",
  },
  outroTrophy: {
    type: String,
    enum: ["bronze", "silver", "gold", ""],
    default: "",
  },
  section: {
    type: Number,
    enum: [1, 2],
    default: 1,
  }
}, { timestamps: true });

const miniLesson = mongoose.model("mini-lessons", miniLessonSchema);


const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: false,
    default: "",
  },
  order: {
    type: Number,
    default: 0
  },
  options: [{
    type: String,
    required: false,
    default: "",
  }],
  solution: {
    type: String,
    required: false,
    default: "",
  },
  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "lessons",
    required: true
  },
  introHeader: {
    type: String,
    default: "",
  },
  introBody: {
    type: String,
    default: "",
  },
  introTrophy: {
    type: String,
    enum: ["bronze", "silver", "gold", ""],
    default: "",
  },
  outroHeader: {
    type: String,
    default: "",
  },
  outroBody: {
    type: String,
    default: "",
  },
  outroTrophy: {
    type: String,
    enum: ["bronze", "silver", "gold", ""],
    default: "",
  },
  section: {
    type: Number,
    enum: [1, 2],
    default: 1,
  }
}, { timestamps: true });

const question = mongoose.model("questions", questionSchema);

const questionCompletedSchema = new mongoose.Schema({
  answer: {
    type: String,
    required: true
  },
  done: {
    type: Boolean,
    default: false
  },
  question: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "questions",
    required: true
  },
  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "lessons",
    required: true
  }, 
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true
  }
}, { timestamps: true });

const questionCompleted = mongoose.model(
  "questions-completed",
  questionCompletedSchema
);

const videoLessonSchema = new mongoose.Schema({
  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "lessons",
    required: true
  },
  url: {
    type: String,
    required: false,
    default: "",
  },
  order: {
    type: Number,
    default: 0
  },
  introHeader: {
    type: String,
    default: "",
  },
  introBody: {
    type: String,
    default: "",
  },
  introTrophy: {
    type: String,
    enum: ["bronze", "silver", "gold", ""],
    default: "",
  },
  outroHeader: {
    type: String,
    default: "",
  },
  outroBody: {
    type: String,
    default: "",
  },
  outroTrophy: {
    type: String,
    enum: ["bronze", "silver", "gold", ""],
    default: "",
  },
  section: {
    type: Number,
    enum: [1, 2],
    default: 1,
  }
}, { timestamps: true });

const videoLesson = mongoose.model("video-lessons", videoLessonSchema);

export { question, lesson, lessonCompleted, questionCompleted, miniLesson, videoLesson };

