import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import storageRouter from "./storage";
import trainingRouter from "./training";
import writtenExamsRouter from "./writtenExams";
import organizationsRouter from "./organizations";
import academicRouter from "./academic";
import academicExamLinksRouter from "./academicExamLinks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(storageRouter);
router.use(trainingRouter);
router.use(writtenExamsRouter);
router.use(organizationsRouter);
router.use(academicRouter);
router.use(academicExamLinksRouter);

export default router;
