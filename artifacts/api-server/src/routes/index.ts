import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import storageRouter from "./storage";
import trainingRouter from "./training";
import writtenExamsRouter from "./writtenExams";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(storageRouter);
router.use(trainingRouter);
router.use(writtenExamsRouter);

export default router;
